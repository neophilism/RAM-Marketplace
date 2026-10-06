import assert from "node:assert/strict";
import test from "node:test";
import { animalSubmissionSchema } from "../lib/validation";

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
