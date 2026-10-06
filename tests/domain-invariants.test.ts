import assert from "node:assert/strict";
import test from "node:test";
import { MATCH_WEIGHTS } from "../lib/domain";
import { canAdvanceOrder } from "../lib/order-policy";
import {
  calculateBuyerPriceCents,
  calculateSupplierAcquisitionPriceCents
} from "../lib/pricing";
import { hasPermission } from "../lib/rbac";
import { canTransitionResearchNeed } from "../lib/workflows";
import {
  canTransitionCandidate,
  canTransitionOrder,
  canonicalCandidateHappyPath,
  canonicalOrderHappyPath
} from "../lib/state-machines";

test("matching weights implement the v1 development-plan model and total 100", () => {
  assert.deepEqual(MATCH_WEIGHTS, {
    phenotypeFit: 30,
    diagnosticConfidence: 20,
    etiologyFit: 15,
    comorbidityFit: 10,
    timingAvailability: 10,
    logisticsFit: 10,
    priceFit: 5
  });
  assert.equal(Object.values(MATCH_WEIGHTS).reduce((sum, weight) => sum + weight, 0), 100);
});

test("supplier acquisition price is capped independently of buyer price", () => {
  const supplierPrice = calculateSupplierAcquisitionPriceCents({
    standardizedCullScheduleCents: 9_000,
    marketCeilingCents: 15_500
  });

  const lowBuyerPrice = calculateBuyerPriceCents({ baseModelCents: 100_000 });
  const highBuyerPrice = calculateBuyerPriceCents({ baseModelCents: 900_000, diagnosticsCents: 50_000 });

  assert.equal(supplierPrice, 9_000);
  assert.notEqual(lowBuyerPrice, highBuyerPrice);
  assert.equal(
    calculateSupplierAcquisitionPriceCents({
      standardizedCullScheduleCents: 9_000,
      marketCeilingCents: 15_500
    }),
    supplierPrice
  );
});

test("supplier acquisition price never exceeds the configured market ceiling", () => {
  assert.equal(
    calculateSupplierAcquisitionPriceCents({
      standardizedCullScheduleCents: 20_000,
      marketCeilingCents: 15_500
    }),
    15_500
  );
});

test("canonical candidate happy path is fully traversable without skipping gates", () => {
  for (let index = 0; index < canonicalCandidateHappyPath.length - 1; index += 1) {
    assert.equal(
      canTransitionCandidate(
        canonicalCandidateHappyPath[index],
        canonicalCandidateHappyPath[index + 1]
      ),
      true
    );
  }
  assert.equal(canTransitionCandidate("SUBMITTED", "MATCHABLE"), false);
  assert.equal(canTransitionCandidate("MATCHABLE", "SOLD_TO_RAM"), false);
});

test("canonical order happy path is fully traversable without skipping commercial gates", () => {
  for (let index = 0; index < canonicalOrderHappyPath.length - 1; index += 1) {
    assert.equal(
      canTransitionOrder(canonicalOrderHappyPath[index], canonicalOrderHappyPath[index + 1]),
      true
    );
  }
  assert.equal(canTransitionOrder("BUYER_COMMITTED", "READY_FOR_PICKUP"), false);
});

test("hard compliance findings prevent READY_FOR_PICKUP", () => {
  assert.equal(
    canAdvanceOrder({
      from: "CLEARANCE_PENDING",
      to: "READY_FOR_PICKUP",
      blockingComplianceFindings: 1
    }),
    false
  );

  assert.equal(
    canAdvanceOrder({
      from: "CLEARANCE_PENDING",
      to: "READY_FOR_PICKUP",
      blockingComplianceFindings: 0
    }),
    true
  );
});

test("RBAC separates supplier, research, compliance, transport and finance powers", () => {
  assert.equal(hasPermission("SUPPLIER_STAFF", "CANDIDATE_CREATE"), true);
  assert.equal(hasPermission("SUPPLIER_STAFF", "PRICING_POLICY_MANAGE"), false);
  assert.equal(hasPermission("RESEARCH_PI", "PAYOUT_MANAGE"), false);
  assert.equal(hasPermission("TRANSPORT_PROVIDER", "RESEARCH_REQUEST_MANAGE"), false);
  assert.equal(hasPermission("RAM_COMPLIANCE", "COMPLIANCE_OVERRIDE"), true);
  assert.equal(hasPermission("RAM_FINANCE_ADMIN", "PRICING_POLICY_MANAGE"), true);
  assert.equal(hasPermission("RESEARCH_COMPLIANCE", "RECEIVING_INSPECTION"), true);
  assert.equal(hasPermission("RESEARCH_PROCUREMENT", "RECEIVING_INSPECTION"), false);
});


test("dispute recovery paths are explicit and do not skip into unrelated states", () => {
  assert.equal(canTransitionOrder("REJECTED_AT_RECEIPT", "DISPUTED"), true);
  assert.equal(canTransitionOrder("DISPUTED", "ACCEPTED"), true);
  assert.equal(canTransitionOrder("DISPUTED", "SETTLED"), true);
  assert.equal(canTransitionOrder("REJECTED_AT_RECEIPT", "ACCEPTED"), false);
  assert.equal(canTransitionResearchNeed("ORDERED", "ACTIVE"), true);
});
