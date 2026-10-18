import assert from "node:assert/strict";
import test from "node:test";
import {
  animalSubmissionSchema,
  clearanceReviewSchema
} from "../lib/validation";

const validSubmission = {
  species: "Swine",
  breed: "Yorkshire cross",
  sex: "Female",
  ageMonths: 18,
  weightKg: 118,
  condition: "Progressive hearing loss",
  diseaseStage: "Moderate",
  observedSigns: "Progressive bilateral hearing impairment documented over several months.",
  firstObservedDate: "2026-03-01",
  existingDiagnosis: "Preliminary farm veterinary assessment",
  currentTreatment: "Supportive care",
  cullDecisionDate: "2026-09-15",
  plannedCullAt: "2026-10-20",
  cullReason: "Animal was independently selected for culling because it is unsuitable for continued production.",
  welfareUrgency: "ROUTINE",
  independentCullAttestation: true,
  ownerAttestation: true
};

test("candidate intake requires independent cull provenance", () => {
  assert.equal(animalSubmissionSchema.safeParse(validSubmission).success, true);

  const withoutIndependentCull = {
    ...validSubmission,
    independentCullAttestation: false
  };
  assert.equal(animalSubmissionSchema.safeParse(withoutIndependentCull).success, false);
});

test("candidate intake requires a cull decision date, planned cull date and reason", () => {
  const missingCullFacts = {
    ...validSubmission,
    cullDecisionDate: "",
    plannedCullAt: "",
    cullReason: ""
  };
  assert.equal(animalSubmissionSchema.safeParse(missingCullFacts).success, false);
});

test("candidate intake rejects malformed, impossible and reversed cull dates", () => {
  for (const dates of [
    { cullDecisionDate: "2026-02-30" },
    { plannedCullAt: "not-a-date" },
    { cullDecisionDate: "2026-10-21", plannedCullAt: "2026-10-20" }
  ]) {
    assert.equal(animalSubmissionSchema.safeParse({ ...validSubmission, ...dates }).success, false);
  }
});


test("clearance cannot pass with an unchecked hard gate", () => {
  const result = clearanceReviewSchema.safeParse({
    orderId: "order-1",
    decision: "CLEARED",
    protocolConfirmed: true,
    receivingFacilityConfirmed: true,
    welfareConfirmed: true,
    biosecurityConfirmed: false,
    movementRequirementsConfirmed: true,
    transportPlanConfirmed: true,
    sourceProvenanceConfirmed: true
  });
  assert.equal(result.success, false);
});

test("failed clearance requires a documented blocking finding", () => {
  const withoutFinding = clearanceReviewSchema.safeParse({
    orderId: "order-1",
    decision: "FAILED",
    protocolConfirmed: true,
    receivingFacilityConfirmed: true,
    welfareConfirmed: true,
    biosecurityConfirmed: false,
    movementRequirementsConfirmed: true,
    transportPlanConfirmed: true,
    sourceProvenanceConfirmed: true
  });
  assert.equal(withoutFinding.success, false);

  const withFinding = clearanceReviewSchema.safeParse({
    orderId: "order-1",
    decision: "FAILED",
    protocolConfirmed: true,
    receivingFacilityConfirmed: true,
    welfareConfirmed: true,
    biosecurityConfirmed: false,
    movementRequirementsConfirmed: true,
    transportPlanConfirmed: true,
    sourceProvenanceConfirmed: true,
    blockingFindings: "Biosecurity clearance not satisfied."
  });
  assert.equal(withFinding.success, true);
});


test("pickup transport event requires sanitation and custody attestations", async () => {
  const { transportEventSchema } = await import("../lib/validation");
  const result = transportEventSchema.safeParse({
    assignmentId: "TA-001",
    eventType: "PICKUP_CONFIRMED"
  });
  assert.equal(result.success, false);
});

test("transport exception requires meaningful notes", async () => {
  const { transportEventSchema } = await import("../lib/validation");
  assert.equal(
    transportEventSchema.safeParse({
      assignmentId: "TA-001",
      eventType: "EXCEPTION_REPORTED",
      notes: "short"
    }).success,
    false
  );
});


test("receiving acceptance requires every intake check", async () => {
  const { receivingInspectionSchema } = await import("../lib/validation");
  assert.equal(
    receivingInspectionSchema.safeParse({
      orderId: "order-1",
      decision: "ACCEPT",
      animalIdentityConfirmed: true,
      movementDocumentsReceived: true,
      physicalConditionConsistent: false,
      welfareIntakeAcceptable: true,
      inspectorAttestation: true
    }).success,
    false
  );

  assert.equal(
    receivingInspectionSchema.safeParse({
      orderId: "order-1",
      decision: "ACCEPT",
      animalIdentityConfirmed: true,
      movementDocumentsReceived: true,
      physicalConditionConsistent: true,
      welfareIntakeAcceptable: true,
      inspectorAttestation: true
    }).success,
    true
  );
});

test("receiving rejection requires a failed check and documented discrepancy", async () => {
  const { receivingInspectionSchema } = await import("../lib/validation");
  assert.equal(
    receivingInspectionSchema.safeParse({
      orderId: "order-1",
      decision: "REJECT",
      animalIdentityConfirmed: true,
      movementDocumentsReceived: true,
      physicalConditionConsistent: true,
      welfareIntakeAcceptable: true,
      discrepancyNotes: "All checks actually passed, so this cannot be rejected.",
      inspectorAttestation: true
    }).success,
    false
  );

  assert.equal(
    receivingInspectionSchema.safeParse({
      orderId: "order-1",
      decision: "REJECT",
      animalIdentityConfirmed: true,
      movementDocumentsReceived: true,
      physicalConditionConsistent: false,
      welfareIntakeAcceptable: true,
      discrepancyNotes: "Physical condition materially differed from the shipping record.",
      inspectorAttestation: true
    }).success,
    true
  );
});


test("financial movement requires a positive amount and external reference", async () => {
  const { financialMovementSchema } = await import("../lib/validation");

  assert.equal(
    financialMovementSchema.safeParse({
      settlementId: "FS-001",
      movementType: "BUYER_PAYMENT",
      amountUsd: 1000,
      externalReference: "bank-123"
    }).success,
    true
  );

  assert.equal(
    financialMovementSchema.safeParse({
      settlementId: "FS-001",
      movementType: "SUPPLIER_PAYOUT",
      amountUsd: 0,
      externalReference: ""
    }).success,
    false
  );
});

test("financial reconciliation requires an explicit attestation", async () => {
  const { settlementCloseSchema } = await import("../lib/validation");

  assert.equal(
    settlementCloseSchema.safeParse({
      settlementId: "FS-001",
      reconciliationReference: "recon-123",
      reconciliationAttestation: true
    }).success,
    true
  );

  assert.equal(
    settlementCloseSchema.safeParse({
      settlementId: "FS-001",
      reconciliationReference: "recon-123",
      reconciliationAttestation: false
    }).success,
    false
  );
});


test("buyer credit and refund are valid financial movement types", async () => {
  const { financialMovementSchema } = await import("../lib/validation");

  for (const movementType of ["BUYER_CREDIT", "BUYER_REFUND"] as const) {
    assert.equal(
      financialMovementSchema.safeParse({
        settlementId: "FS-001",
        movementType,
        amountUsd: 100,
        externalReference: "adjustment-123"
      }).success,
      true
    );
  }
});

test("dispute resolution requires rationale and attestation", async () => {
  const { disputeResolutionSchema } = await import("../lib/validation");

  assert.equal(
    disputeResolutionSchema.safeParse({
      disputeId: "OD-001",
      resolutionType: "REPLACEMENT",
      resolutionNotes: "Receiving findings justify a replacement and full financial unwind.",
      operatorAttestation: true
    }).success,
    true
  );

  assert.equal(
    disputeResolutionSchema.safeParse({
      disputeId: "OD-001",
      resolutionType: "REFUND",
      resolutionNotes: "short",
      operatorAttestation: false
    }).success,
    false
  );
});
