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

  assert.ok(migrations.length >= 3);
  assert.equal(migrations[0], "20261006062000_initial");
  assert.equal(migrations[1], "20261006130000_identity_access");
  assert.equal(migrations[2], "20261006144500_payment_execution");
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


test("identity lifecycle migration adds external identity and verification controls", () => {
  const sql = readFileSync(
    join(
      migrationRoot,
      "20261006130000_identity_access",
      "migration.sql"
    ),
    "utf8"
  );

  for (const table of [
    "ExternalIdentity",
    "IdentityAssertionUse",
    "OrganizationVerification"
  ]) {
    assert.match(sql, new RegExp('CREATE TABLE "' + table + '"'));
  }

  assert.match(sql, /ExternalIdentity_provider_subject_key/);
  assert.match(sql, /Membership_userId_status_idx/);
  assert.match(sql, /MIGRATION_GRANDFATHERED/);
});


test("payment execution migration adds durable execution and webhook idempotency tables", () => {
  const sql = readFileSync(
    join(
      migrationRoot,
      "20261006144500_payment_execution",
      "migration.sql"
    ),
    "utf8"
  );

  for (const table of [
    "OrganizationPaymentProfile",
    "PaymentExecution",
    "PaymentWebhookReceipt"
  ]) {
    assert.match(sql, new RegExp('CREATE TABLE "' + table + '"'));
  }

  assert.match(sql, /PaymentExecution_idempotencyKey_key/);
  assert.match(sql, /PaymentWebhookReceipt_gateway_eventId_key/);
  assert.match(sql, /OrganizationPaymentProfile_organizationId_key/);
  assert.match(sql, /PaymentExecution_settlementId_fkey/);
  assert.match(sql, /PaymentExecution_counterpartyOrganizationId_fkey/);
  assert.match(sql, /PaymentExecution_requestedByUserId_fkey/);
  assert.match(sql, /SUBMISSION_UNKNOWN/);
});
