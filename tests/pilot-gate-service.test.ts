import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { PILOT_MANUAL_GATES } from "../lib/pilot-readiness";
import * as status from "../lib/pilot-gate-status";

// Execute the actual service with an explicit transaction fixture. These are
// orchestration tests, not real PostgreSQL/Prisma or HTTP acceptance evidence.
const source = readFileSync("lib/server/pilot-gates.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
} }).outputText;
const principal = { role: "RAM_ADMIN", userId: "synthetic-admin", organizationId: "synthetic-ram" };
const valid = { gateKey: "manual_monitoring", ownerUserId: "synthetic-owner", evidenceSummary: "  Synthetic signed-alert rehearsal evidence.  " };
type Data = Record<string, unknown>;
type Services = {
  listPilotGateAdministration: (principal: Data, now?: Date) => Promise<{ gates: Array<{ key: string; effectiveStatus: string }>; owners: unknown[] }>;
  verifyPilotGate: (principal: Data, input: Data) => Promise<Data>;
  resetPilotGate: (principal: Data, input: Data) => Promise<Data>;
  pilotGateSummary: typeof status.pilotGateSummary;
};
function fixture(options: { owner?: boolean; auditFailure?: boolean; rows?: Data[]; backend?: string } = {}) {
  let databaseCalls = 0, transactions = 0;
  const committed: Data[] = [], membershipQueries: Data[] = [];
  const prisma = {
    pilotGateVerification: { findMany: async () => options.rows ?? [] },
    membership: { findMany: async () => [{ user: { id: "synthetic-owner", name: "Fixture", email: "owner@example.test" } }] },
    async $transaction<T>(work: (tx: unknown) => Promise<T>) {
      transactions++;
      const staged: Data[] = [];
      const tx = {
        membership: { findFirst: async (query: Data) => {
          membershipQueries.push(query);
          return options.owner === false ? null : { user: { id: "synthetic-owner" } };
        } },
        pilotGateVerification: {
          findUnique: async () => null,
          upsert: async (query: { create: Data; update: Data }) => {
            staged.push({ operation: "upsert", ...query });
            return { id: "synthetic-record", ...query.create };
          }
        },
        auditEvent: { create: async (query: Data) => {
          if (options.auditFailure) throw new Error("Synthetic audit failure");
          staged.push({ operation: "audit", ...query });
          return {};
        } }
      };
      const result = await work(tx);
      committed.push(...staged);
      return result;
    }
  };
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "@/lib/access": { requireCapability(role: string, capability: string) {
      assert.equal(capability, "admin:manage");
      if (role !== "RAM_ADMIN") throw new Error("Synthetic access denied");
    } },
    "@/lib/pilot-readiness": { PILOT_MANUAL_GATES },
    "@/lib/pilot-gates": { pilotGateKeys: new Set(PILOT_MANUAL_GATES.map((gate) => gate.key)) },
    "@/lib/pilot-gate-status": status,
    "@/lib/server/db": { dataBackend: () => options.backend ?? "postgres", requirePrisma: () => { databaseCalls++; return prisma; } }
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, Date,
    require(name: string) { assert.ok(Object.hasOwn(dependencies, name), "Unexpected service import"); return dependencies[name]; }
  });
  return { service: module.exports as Services, committed, membershipQueries, databaseCalls: () => databaseCalls, transactions: () => transactions };
}
for (const operation of ["list", "verify", "reset"] as const)
  test(operation + " keeps the admin capability check before database access", async () => {
    const f = fixture(), denied = { ...principal, role: "FARM" };
    const work = operation === "list" ? f.service.listPilotGateAdministration(denied) : operation === "verify" ?
      f.service.verifyPilotGate(denied, valid) : f.service.resetPilotGate(denied, { gateKey: valid.gateKey, reason: "Synthetic reset" });
    await assert.rejects(work, /access denied/);
    assert.equal(f.databaseCalls(), 0);
  });
test("service cannot persist blank verification evidence even when bypassing transport parsing", async () => {
  const f = fixture();
  await assert.rejects(f.service.verifyPilotGate(principal, { ...valid, evidenceSummary: " ".repeat(20) }), /meaningful/);
  assert.equal(f.databaseCalls(), 0); assert.equal(f.transactions(), 0);
});
test("service cannot reset a gate with a blank reason", async () => {
  const f = fixture();
  await assert.rejects(f.service.resetPilotGate(principal, { gateKey: valid.gateKey, reason: "   " }), /meaningful/);
  assert.equal(f.databaseCalls(), 0); assert.equal(f.transactions(), 0);
});
test("inactive owners remain rejected inside the existing transaction", async () => {
  const f = fixture({ owner: false });
  await assert.rejects(f.service.verifyPilotGate(principal, valid), /active member/);
  assert.equal(f.transactions(), 1); assert.equal(f.committed.length, 0);
  const where = f.membershipQueries[0].where as Data;
  assert.equal(where.status, "ACTIVE");
  assert.equal((where.organization as Data).type, "RAM");
  assert.equal((where.organization as Data).status, "ACTIVE");
});
test("valid evidence retains actor identity, active owner and an atomic audit", async () => {
  const f = fixture(); const result = await f.service.verifyPilotGate(principal, valid);
  assert.equal(result.evidenceSummary, valid.evidenceSummary.trim());
  assert.equal(result.verifiedByUserId, principal.userId);
  assert.equal(result.ownerUserId, valid.ownerUserId);
  assert.equal(result.status, "VERIFIED");
  assert.equal(f.committed.length, 2);
  assert.equal((f.committed[1].data as Data).action, "PILOT_GATE_VERIFIED");
});
test("audit failure rejects verification without committing staged fixture writes", async () => {
  const f = fixture({ auditFailure: true });
  await assert.rejects(f.service.verifyPilotGate(principal, valid), /audit failure/);
  assert.equal(f.committed.length, 0);
});
test("reset preserves pending state, clears prior verification, and audits the normalized reason", async () => {
  const f = fixture();
  const result = await f.service.resetPilotGate(principal, { gateKey: valid.gateKey, reason: "  Synthetic invalidation  " });
  assert.equal(result.status, "PENDING");
  const update = f.committed[0].update as Data;
  for (const key of ["evidenceSummary", "verifiedByUserId", "verifiedAt", "reviewDueAt"]) assert.equal(update[key], null);
  assert.equal((f.committed[1].data as Data).reason, "Synthetic invalidation");
});
test("read path applies complete persisted-evidence validation, not just the status label", async () => {
  const now = new Date("2026-01-02T00:00:00Z");
  const f = fixture({ rows: [{ gateKey: valid.gateKey, status: "VERIFIED", reviewDueAt: null,
    ownerUserId: valid.ownerUserId, verifiedByUserId: principal.userId, verifiedAt: new Date("2026-01-01T00:00:00Z"), evidenceSummary: "   " }] });
  const result = await f.service.listPilotGateAdministration(principal, now);
  assert.equal(result.gates.length, PILOT_MANUAL_GATES.length);
  assert.equal(result.gates.find((gate) => gate.key === valid.gateKey)?.effectiveStatus, "PENDING");
  assert.equal(f.service.pilotGateSummary([]).ready, false);
});
test("prototype administration cannot claim persisted verification", async () => {
  const f = fixture({ backend: "prototype" });
  const result = await f.service.listPilotGateAdministration(principal);
  assert.equal(result.gates.every((gate) => gate.effectiveStatus === "PENDING"), true);
  await assert.rejects(f.service.verifyPilotGate(principal, valid), /PostgreSQL/);
  assert.equal(f.databaseCalls(), 0);
});
for (const [label, entries] of [
  ["empty", []],
  ["partial", [{ key: "manual_monitoring", effectiveStatus: "VERIFIED" as const }]],
  ["duplicates", PILOT_MANUAL_GATES.map(() => ({ key: "manual_monitoring", effectiveStatus: "VERIFIED" as const }))]
] as const) test("server summary refuses " + label + " gate inventory", () => {
  assert.equal(fixture().service.pilotGateSummary(entries).ready, false);
});
