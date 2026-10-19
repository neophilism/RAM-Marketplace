/** Offline comparison only. This module never changes production ranking. */
export interface ShadowMatch {
  animalCaseId: string;
  researchNeedId: string;
  eligible: boolean;
  totalScore: number;
  hardGates: readonly { gate: string; state: "PASS" | "FAIL" | "REVIEW" }[];
}

export interface RankingEvaluation {
  researchNeedId: string;
  baselineTopIds: string[];
  challengerTopIds: string[];
  hardGateRegressions: string[];
  baselinePrecisionAtK: number;
  challengerPrecisionAtK: number;
  baselineRecallAtK: number;
  challengerRecallAtK: number;
  labeledCandidateCount: number;
  passesSafety: boolean;
  passesOfflineComparison: boolean;
}

function validateRecords(records: readonly ShadowMatch[], label: string): Map<string, ShadowMatch> {
  if (records.length === 0) throw new Error(`${label} ranking is empty`);
  const byId = new Map<string, ShadowMatch>();
  const needId = records[0].researchNeedId;
  if (!needId) throw new Error(`${label} has no research need`);
  for (const item of records) {
    if (!item.animalCaseId || item.researchNeedId !== needId || byId.has(item.animalCaseId)) {
      throw new Error(`${label} has missing, mixed or duplicate identifiers`);
    }
    if (!Number.isFinite(item.totalScore) || item.totalScore < 0 || item.totalScore > 100) {
      throw new Error(`${label} has an invalid score`);
    }
    if (!Array.isArray(item.hardGates) || item.hardGates.length === 0) {
      throw new Error(`${label} has no hard-gate evidence`);
    }
    const gateNames = new Set<string>();
    for (const gate of item.hardGates) {
      if (!gate || typeof gate.gate !== "string" || !gate.gate.trim() ||
          !["PASS", "FAIL", "REVIEW"].includes(gate.state) || gateNames.has(gate.gate)) {
        throw new Error(`${label} has malformed or duplicate hard-gate evidence`);
      }
      gateNames.add(gate.gate);
    }
    if (item.eligible && item.hardGates.some((gate) => gate.state !== "PASS")) {
      throw new Error(`${label} claims eligibility despite its own failed hard gate`);
    }
    byId.set(item.animalCaseId, item);
  }
  return byId;
}

function rankedIds(records: readonly ShadowMatch[]): string[] {
  return records.filter((item) => item.eligible)
    .sort((a, b) => b.totalScore - a.totalScore || a.animalCaseId.localeCompare(b.animalCaseId))
    .map((item) => item.animalCaseId);
}

function precisionAtK(ids: readonly string[], labels: Readonly<Record<string, boolean>>, k: number): number {
  const viewed = ids.slice(0, k);
  if (viewed.length === 0) return 0;
  return viewed.filter((id) => labels[id]).length / viewed.length;
}

function recallAtK(ids: readonly string[], labels: Readonly<Record<string, boolean>>, k: number, relevantEligible: number): number {
  if (relevantEligible === 0) return 1;
  return ids.slice(0, k).filter((id) => labels[id]).length / relevantEligible;
}

/** Compare complete, frozen candidate sets with reviewed binary relevance labels. */
export function evaluateShadowRanking(
  baseline: readonly ShadowMatch[],
  challenger: readonly ShadowMatch[],
  labels: Readonly<Record<string, boolean>>,
  topK = 5
): RankingEvaluation {
  if (!Number.isInteger(topK) || topK < 1) throw new Error("topK must be a positive integer");
  const base = validateRecords(baseline, "baseline");
  const proposed = validateRecords(challenger, "challenger");
  if (base.size !== proposed.size || [...base.keys()].some((id) => !proposed.has(id))) {
    throw new Error("candidate sets differ");
  }
  const researchNeedId = baseline[0].researchNeedId;
  if (challenger[0].researchNeedId !== researchNeedId) throw new Error("research needs differ");
  for (const id of base.keys()) {
    if (typeof labels[id] !== "boolean") throw new Error(`reviewed relevance label missing for ${id}`);
  }

  const hardGateRegressions = [...base.values()]
    .filter((item) => item.hardGates.some((gate) => gate.state !== "PASS") && proposed.get(item.animalCaseId)?.eligible)
    .map((item) => item.animalCaseId)
    .sort();

  // The baseline hard gates remain authoritative even in an offline comparison.
  const permitted = new Set([...base.values()]
    .filter((item) => item.hardGates.every((gate) => gate.state === "PASS"))
    .map((item) => item.animalCaseId));
  const baselineTopIds = rankedIds([...base.values()]);
  const challengerTopIds = rankedIds([...proposed.values()].filter((item) => permitted.has(item.animalCaseId)));
  const baselinePrecisionAtK = precisionAtK(baselineTopIds, labels, topK);
  const challengerPrecisionAtK = precisionAtK(challengerTopIds, labels, topK);
  const relevantEligible = baselineTopIds.filter((id) => labels[id]).length;
  const baselineRecallAtK = recallAtK(baselineTopIds, labels, topK, relevantEligible);
  const challengerRecallAtK = recallAtK(challengerTopIds, labels, topK, relevantEligible);
  const passesSafety = hardGateRegressions.length === 0;

  return {
    researchNeedId,
    baselineTopIds: baselineTopIds.slice(0, topK),
    challengerTopIds: challengerTopIds.slice(0, topK),
    hardGateRegressions,
    baselinePrecisionAtK,
    challengerPrecisionAtK,
    baselineRecallAtK,
    challengerRecallAtK,
    labeledCandidateCount: base.size,
    passesSafety,
    passesOfflineComparison: passesSafety &&
      challengerPrecisionAtK >= baselinePrecisionAtK &&
      challengerRecallAtK >= baselineRecallAtK
  };
}
