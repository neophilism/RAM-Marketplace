import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateIndependentSupplierCommitment,
  countBlockingClearanceFindings,
  createQuoteSnapshot,
  expiresAt,
  isExpired
} from "../lib/transaction-policy";

test("buyer quote composition cannot affect supplier acquisition commitment", () => {
  const quoteA = createQuoteSnapshot(300_000);
  const quoteB = createQuoteSnapshot(900_000, {
    diagnosticsCents: 50_000,
    serviceCents: 20_000
  });

  const supplierA = calculateIndependentSupplierCommitment({
    standardizedCullScheduleCents: 12_000,
    marketCeilingCents: 15_000
  });
  const supplierB = calculateIndependentSupplierCommitment({
    standardizedCullScheduleCents: 12_000,
    marketCeilingCents: 15_000
  });

  assert.notEqual(quoteA.buyerPriceCents, quoteB.buyerPriceCents);
  assert.equal(supplierA, 12_000);
  assert.equal(supplierB, supplierA);
});

test("supplier commitment remains capped by market ceiling", () => {
  assert.equal(
    calculateIndependentSupplierCommitment({
      standardizedCullScheduleCents: 20_000,
      marketCeilingCents: 15_000
    }),
    15_000
  );
});

test("hold and quote expiration use explicit timestamps", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const expiry = expiresAt(24, now);
  assert.equal(expiry.toISOString(), "2026-10-07T12:00:00.000Z");
  assert.equal(isExpired(expiry, new Date("2026-10-07T11:59:59.000Z")), false);
  assert.equal(isExpired(expiry, new Date("2026-10-07T12:00:00.000Z")), true);
});

test("every unchecked clearance gate is blocking", () => {
  assert.equal(
    countBlockingClearanceFindings(
      {
        protocolConfirmed: true,
        receivingFacilityConfirmed: true,
        welfareConfirmed: true,
        biosecurityConfirmed: false,
        movementRequirementsConfirmed: true,
        transportPlanConfirmed: true,
        sourceProvenanceConfirmed: true
      },
      []
    ),
    1
  );
});
