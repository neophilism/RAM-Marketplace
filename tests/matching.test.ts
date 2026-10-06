import assert from "node:assert/strict";
import test from "node:test";
import { scoreMatch } from "../lib/matching";

const need = {
  id: "need-1",
  status: "ACTIVE",
  condition: "sensorineural hearing loss",
  species: "Swine",
  minAgeMonths: 12,
  maxAgeMonths: 30,
  sex: "Any",
  diseaseStage: "moderate",
  requiredPhenotype: "bilateral hearing threshold elevation stable vestibular function",
  exclusionCriteria: "active ear infection",
  acceptableComorbidities: "mild osteoarthritis",
  requiredDiagnostics: "ABR",
  timeline: "within 30 days",
  budgetCents: 800_000
};

const animal = {
  id: "RAM-SW-1",
  status: "MATCHABLE",
  species: "Swine",
  sex: "Female",
  ageMonths: 18,
  condition: "Progressive sensorineural hearing loss",
  diseaseStage: "Moderate",
  diagnosticConfidence: "Confirmed",
  phenotype: [
    "Bilateral threshold elevation",
    "Stable vestibular function",
    "No otitis externa"
  ],
  etiology: "Naturally progressive sensorineural disorder",
  comorbidities: ["Mild osteoarthritis"],
  diagnosticEvidence: ["ABR confirms bilateral threshold elevation"],
  publicSummary: "Naturally occurring bilateral auditory impairment.",
  listPriceCents: 780_000,
  transportReady: true,
  availabilityText: "14 days"
};

test("matching hard-fails an incompatible species", () => {
  const result = scoreMatch({ ...animal, species: "Bovine" }, need);
  assert.equal(result.eligible, false);
  assert.equal(result.totalScore, 0);
  assert.equal(result.hardGates.find((gate) => gate.gate === "species")?.state, "FAIL");
});

test("matching hard-fails candidates that are not marketplace eligible", () => {
  const result = scoreMatch({ ...animal, status: "VERIFIED" }, need);
  assert.equal(result.eligible, false);
  assert.equal(result.hardGates.find((gate) => gate.gate === "candidate_status")?.state, "FAIL");
});

test("matching produces an explainable score out of 100", () => {
  const result = scoreMatch(animal, need);
  assert.equal(result.eligible, true);
  assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
  assert.equal(
    Object.values(result.components).reduce((sum, value) => sum + value, 0),
    result.totalScore
  );
  assert.equal(result.components.diagnosticConfidence, 20);
  assert.equal(result.components.logisticsFit, 10);
  assert.equal(result.components.priceFit, 5);
  assert.ok(result.reasons.length >= 7);
});

test("missing constrained demographics become explicit review flags, not assumed values", () => {
  const constrained = { ...need, sex: "Female", minAgeMonths: 12 };
  const result = scoreMatch({ ...animal, sex: "Unknown", ageMonths: null }, constrained);
  assert.equal(result.eligible, true);
  assert.equal(result.hardGates.find((gate) => gate.gate === "sex")?.state, "REVIEW");
  assert.equal(result.hardGates.find((gate) => gate.gate === "age")?.state, "REVIEW");
  assert.ok(result.reviewFlags.some((flag) => /age/i.test(flag)));
  assert.ok(result.reviewFlags.some((flag) => /sex/i.test(flag)));
});


test("required diagnostics create a review flag when evidence is absent", () => {
  const result = scoreMatch({ ...animal, diagnosticEvidence: [] }, need);
  assert.equal(result.eligible, true);
  assert.equal(
    result.hardGates.find((gate) => gate.gate === "required_diagnostics")?.state,
    "REVIEW"
  );
  assert.ok(result.reviewFlags.some((flag) => /diagnostics/i.test(flag)));
  assert.ok(result.components.diagnosticConfidence <= 10);
});


test("explicit exclusion criteria are hard gates", () => {
  const excluded = scoreMatch(
    { ...animal, comorbidities: ["Active ear infection"] },
    need
  );
  assert.equal(excluded.eligible, false);
  assert.equal(excluded.totalScore, 0);
  assert.equal(
    excluded.hardGates.find((gate) => gate.gate === "exclusion_criteria")?.state,
    "FAIL"
  );
});
