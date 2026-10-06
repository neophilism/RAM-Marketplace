import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationRoot = join("prisma", "migrations");

test("PostgreSQL migration history is committed and provider-locked", () => {
  const lock = readFileSync(join(migrationRoot, "migration_lock.toml"), "utf8");
  assert.match(lock, /provider\s*=\s*"postgresql"/);

  const migrations = readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.ok(migrations.length >= 1);
  assert.equal(migrations[0], "20261006062000_initial");
});

test("initial migration contains core business, ledger, audit and security tables", () => {
  const sql = readFileSync(
    join(migrationRoot, "20261006062000_initial", "migration.sql"),
    "utf8"
  );

  for (const table of [
    "Organization",
    "AnimalCase",
    "AnimalSourceRecord",
    "ResearchNeed",
    "Order",
    "TransportAssignment",
    "ReceiptInspection",
    "OrderDispute",
    "FinancialSettlement",
    "FinancialLedgerEntry",
    "SecurityRateLimitBucket",
    "AuditEvent"
  ]) {
    assert.match(sql, new RegExp('CREATE TABLE "' + table + '"'));
  }

  assert.match(sql, /FinancialLedgerEntry_settlementId_fkey/);
  assert.match(sql, /AuditEvent_actorUserId_fkey/);
  assert.match(sql, /ResearchMatch_researchNeedId_animalCaseId_key/);
});
