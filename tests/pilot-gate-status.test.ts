import assert from "node:assert/strict";
import test from "node:test";
import { PILOT_MANUAL_GATES } from "../lib/pilot-readiness";
import { pilotGateEffectiveStatus, pilotGateSummary, pilotResetReason, pilotVerificationEvidence, type PilotGateEvidence } from "../lib/pilot-gate-status";
const now = new Date("2026-01-02T12:00:00Z");
const verified: PilotGateEvidence = { status: "VERIFIED", ownerUserId: "synthetic-owner", verifiedByUserId: "synthetic-verifier",
  evidenceSummary: "Synthetic evidence fixture, not a real pilot approval.", verifiedAt: new Date("2026-01-01T12:00:00Z"), reviewDueAt: new Date("2026-01-03T12:00:00Z") };
const gates = () => PILOT_MANUAL_GATES.map((gate) => ({ key: gate.key, effectiveStatus: "VERIFIED" as const }));

test("complete canonical evidence reports verified without modifying inputs", () => {
  assert.equal(pilotGateEffectiveStatus(Object.freeze({ ...verified }), now), "VERIFIED");
  assert.equal(pilotGateEffectiveStatus({ ...verified, reviewDueAt: null }, now), "VERIFIED");
  assert.equal(pilotGateEffectiveStatus({ ...verified, reviewDueAt: undefined }, now), "VERIFIED");
  assert.deepEqual(pilotGateSummary(Object.freeze(gates())), { total: 6, verified: 6, expired: 0, pending: 0, ready: true });
});
for (const [label, record] of [
  ["missing", undefined], ["null", null], ["pending", { ...verified, status: "PENDING" }], ["unknown state", { ...verified, status: "UNKNOWN" }],
  ["missing owner", { ...verified, ownerUserId: null }], ["blank owner", { ...verified, ownerUserId: "  " }],
  ["missing verifier", { ...verified, verifiedByUserId: null }], ["blank verifier", { ...verified, verifiedByUserId: " " }],
  ["missing evidence", { ...verified, evidenceSummary: null }], ["blank evidence", { ...verified, evidenceSummary: " ".repeat(20) }],
  ["short evidence", { ...verified, evidenceSummary: "short" }], ["oversized evidence", { ...verified, evidenceSummary: "x".repeat(4001) }],
  ["missing verification time", { ...verified, verifiedAt: null }], ["invalid verification time", { ...verified, verifiedAt: new Date(NaN) }],
  ["future verification", { ...verified, verifiedAt: new Date(now.getTime() + 1) }]
] as const) test("incomplete persisted gate cannot be verified: " + label, () => {
  assert.equal(pilotGateEffectiveStatus(record, now), "PENDING");
});
test("an invalid evaluation clock cannot certify a persisted gate", () => {
  assert.equal(pilotGateEffectiveStatus(verified, new Date(NaN)), "PENDING");
});
for (const due of [new Date(NaN), new Date(now), new Date(now.getTime() - 1)])
  test("expired or invalid review deadline fails closed: " + String(due), () => {
    assert.equal(pilotGateEffectiveStatus({ ...verified, reviewDueAt: due }, now), "EXPIRED");
  });
test("the exact verification instant and one millisecond before review expiry remain valid", () => {
  assert.equal(pilotGateEffectiveStatus({ ...verified, verifiedAt: now, reviewDueAt: new Date(now.getTime() + 1) }, now), "VERIFIED");
});
for (const [label, value] of [
  ["empty", []], ["one gate", gates().slice(0, 1)], ["missing one", gates().slice(1)],
  ["duplicate", gates().map((gate, index) => index === 5 ? gates()[0] : gate)],
  ["unknown substitute", gates().map((gate, index) => index === 5 ? { ...gate, key: "not-a-pilot-gate" } : gate)],
  ["extra gate", [...gates(), { key: "extra", effectiveStatus: "VERIFIED" as const }]],
  ["missing identities", gates().map(() => ({ effectiveStatus: "VERIFIED" as const }))]
] as const) test("summary cannot certify an incomplete inventory: " + label, () => {
  assert.equal(pilotGateSummary(value).ready, false);
});
test("pending and expired counts remain explicit while completeness blocks readiness", () => {
  const value = gates().map((gate, i) => ({ ...gate, effectiveStatus: (i === 0 ? "PENDING" : i === 1 ? "EXPIRED" : "VERIFIED") as "PENDING" | "EXPIRED" | "VERIFIED" }));
  assert.deepEqual(pilotGateSummary(value), { total: 6, verified: 4, expired: 1, pending: 1, ready: false });
  assert.equal(pilotGateSummary(gates().reverse()).ready, true);
});
for (const [label, validate, min] of [["verification", pilotVerificationEvidence, 10], ["reset", pilotResetReason, 3]] as const) {
  test(label + " rejects whitespace, short and malformed evidence without echoing values", () => {
    for (const value of [null, undefined, {}, [], 42, " ".repeat(20), " x ", "x".repeat(4001)]) assert.throws(() => validate(value), /meaningful/);
    assert.equal(validate(" " + "x".repeat(min) + " "), "x".repeat(min));
    assert.equal(validate("x".repeat(4000)).length, 4000);
  });
}
