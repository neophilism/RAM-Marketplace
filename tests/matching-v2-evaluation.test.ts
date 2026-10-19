import assert from "node:assert/strict";
import test from "node:test";
import { evaluateShadowRanking, type ShadowMatch } from "../lib/matching-v2-evaluation";

const pass = [{ gate: "species", state: "PASS" as const }];
const fail = [{ gate: "species", state: "FAIL" as const }];
const baseline: ShadowMatch[] = [
  { animalCaseId: "a", researchNeedId: "need-1", eligible: true, totalScore: 90, hardGates: pass },
  { animalCaseId: "b", researchNeedId: "need-1", eligible: true, totalScore: 70, hardGates: pass },
  { animalCaseId: "c", researchNeedId: "need-1", eligible: false, totalScore: 0, hardGates: fail }
];
const labels = { a: false, b: true, c: true };

test("shadow ranking improves reviewed relevance without activating a failed baseline gate", () => {
  const challenger: ShadowMatch[] = baseline.map((item) => ({
    ...item,
    totalScore: item.animalCaseId === "b" ? 95 : item.totalScore
  }));
  const result = evaluateShadowRanking(baseline, challenger, labels, 1);
  assert.deepEqual(result.baselineTopIds, ["a"]);
  assert.deepEqual(result.challengerTopIds, ["b"]);
  assert.equal(result.baselinePrecisionAtK, 0);
  assert.equal(result.challengerPrecisionAtK, 1);
  assert.equal(result.challengerRecallAtK, 1);
  assert.equal(result.passesOfflineComparison, true);
});

test("dropping a reviewed relevant candidate fails recall comparison", () => {
  const challenger: ShadowMatch[] = baseline.map((item) => item.animalCaseId === "b"
    ? { ...item, eligible: false }
    : item);
  const result = evaluateShadowRanking(baseline, challenger, labels, 2);
  assert.equal(result.baselineRecallAtK, 1);
  assert.equal(result.challengerRecallAtK, 0);
  assert.equal(result.passesOfflineComparison, false);
});

test("a permissive challenger gate fails evaluation and cannot rank the blocked animal", () => {
  const challenger: ShadowMatch[] = baseline.map((item) => item.animalCaseId === "c"
    ? { ...item, eligible: true, totalScore: 99, hardGates: pass }
    : item);
  const result = evaluateShadowRanking(baseline, challenger, labels, 2);
  assert.deepEqual(result.hardGateRegressions, ["c"]);
  assert.equal(result.challengerTopIds.includes("c"), false);
  assert.equal(result.passesSafety, false);
  assert.equal(result.passesOfflineComparison, false);
});

test("missing labels, changed candidate sets, duplicates and invalid scores fail closed", () => {
  assert.throws(() => evaluateShadowRanking(baseline, baseline, { a: true, b: false }), /label missing/);
  assert.throws(() => evaluateShadowRanking(baseline, baseline.slice(0, 2), labels), /candidate sets differ/);
  assert.throws(() => evaluateShadowRanking(baseline, [...baseline, baseline[0]], labels), /duplicate/);
  assert.throws(() => evaluateShadowRanking(baseline, baseline.map((item) => ({ ...item, totalScore: NaN })), labels), /invalid score/);
  assert.throws(() => evaluateShadowRanking(baseline, baseline, labels, 0), /topK/);
});

test("review-pending baseline hard gates cannot be promoted by a challenger", () => {
  const pending: ShadowMatch[] = [
    ...baseline,
    { animalCaseId: "d", researchNeedId: "need-1", eligible: false, totalScore: 60, hardGates: [{ gate: "vet", state: "REVIEW" }] }
  ];
  const challenger = pending.map((item) => item.animalCaseId === "d"
    ? { ...item, eligible: true, totalScore: 99, hardGates: pass }
    : item);
  const result = evaluateShadowRanking(pending, challenger, { ...labels, d: true });
  assert.deepEqual(result.hardGateRegressions, ["d"]);
  assert.ok(!result.challengerTopIds.includes("d"));
  assert.equal(result.passesSafety, false);
  assert.throws(() => evaluateShadowRanking(pending.map((item) => item.animalCaseId === "d"
    ? { ...item, eligible: true }
    : item), pending, { ...labels, d: true }), /failed hard gate/);
});
