import { MATCH_WEIGHTS } from "./domain";

export interface MatchAnimal {
  id: string;
  status: string;
  species: string;
  sex?: string | null;
  ageMonths?: number | null;
  condition: string;
  diseaseStage?: string | null;
  diagnosticConfidence?: string | null;
  phenotype: string[];
  publicSummary: string;
  listPriceCents?: number | null;
  transportReady: boolean;
  availabilityText?: string | null;
}

export interface MatchNeed {
  id: string;
  status: string;
  condition: string;
  species?: string | null;
  minAgeMonths?: number | null;
  maxAgeMonths?: number | null;
  sex?: string | null;
  diseaseStage?: string | null;
  requiredPhenotype: string;
  exclusionCriteria?: string | null;
  acceptableComorbidities?: string | null;
  requiredDiagnostics?: string | null;
  timeline: string;
  budgetCents?: number | null;
}

export type GateState = "PASS" | "FAIL" | "REVIEW";

export interface HardGateResult {
  gate: string;
  state: GateState;
  reason: string;
}

export interface MatchComponents {
  phenotypeFit: number;
  diagnosticConfidence: number;
  etiologyFit: number;
  comorbidityFit: number;
  timingAvailability: number;
  logisticsFit: number;
  priceFit: number;
}

export interface ExplainableMatch {
  animalCaseId: string;
  researchNeedId: string;
  eligible: boolean;
  totalScore: number;
  components: MatchComponents;
  hardGates: HardGateResult[];
  reviewFlags: string[];
  reasons: string[];
}

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","in","is",
  "it","of","on","or","that","the","to","with","without","model","animal","animals",
  "required","acceptable","study","research"
]);

function tokens(value: string | null | undefined) {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  );
}

function coverage(required: string | null | undefined, candidate: string | null | undefined) {
  const need = tokens(required);
  if (need.size === 0) return 1;
  const available = tokens(candidate);
  let hits = 0;
  for (const token of need) if (available.has(token)) hits += 1;
  return hits / need.size;
}

function boundedScore(weight: number, ratio: number) {
  return Math.max(0, Math.min(weight, Math.round(weight * ratio)));
}

function parseDays(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("week")) return Math.round(amount * 7);
  if (unit.startsWith("month")) return Math.round(amount * 30);
  return Math.round(amount);
}

function confidenceScore(value: string | null | undefined) {
  if (value === "Confirmed") return MATCH_WEIGHTS.diagnosticConfidence;
  if (value === "High") return 16;
  if (value === "Moderate") return 12;
  return 6;
}

export function scoreMatch(animal: MatchAnimal, need: MatchNeed): ExplainableMatch {
  const gates: HardGateResult[] = [];
  const reviewFlags: string[] = [];
  const reasons: string[] = [];

  gates.push({
    gate: "candidate_status",
    state: animal.status === "MATCHABLE" ? "PASS" : "FAIL",
    reason: animal.status === "MATCHABLE"
      ? "Candidate is approved and marketable."
      : `Candidate status is ${animal.status}, not MATCHABLE.`
  });

  if (need.species?.trim()) {
    const pass = animal.species.trim().toLowerCase() === need.species.trim().toLowerCase();
    gates.push({
      gate: "species",
      state: pass ? "PASS" : "FAIL",
      reason: pass
        ? `Species matches required ${need.species}.`
        : `Candidate species ${animal.species} does not match required ${need.species}.`
    });
  } else {
    gates.push({ gate: "species", state: "PASS", reason: "Research need accepts multiple species." });
  }

  if (need.minAgeMonths != null || need.maxAgeMonths != null) {
    if (animal.ageMonths == null) {
      gates.push({ gate: "age", state: "REVIEW", reason: "Candidate age is missing and must be verified." });
      reviewFlags.push("Verify age against research constraints.");
    } else {
      const tooYoung = need.minAgeMonths != null && animal.ageMonths < need.minAgeMonths;
      const tooOld = need.maxAgeMonths != null && animal.ageMonths > need.maxAgeMonths;
      gates.push({
        gate: "age",
        state: tooYoung || tooOld ? "FAIL" : "PASS",
        reason: tooYoung || tooOld
          ? `Candidate age ${animal.ageMonths} months is outside the required range.`
          : "Candidate age satisfies the required range."
      });
    }
  } else {
    gates.push({ gate: "age", state: "PASS", reason: "No age hard gate specified." });
  }

  if (need.sex && need.sex !== "Any") {
    if (!animal.sex || animal.sex === "Unknown") {
      gates.push({ gate: "sex", state: "REVIEW", reason: "Candidate sex is not confirmed." });
      reviewFlags.push("Confirm sex before selection.");
    } else {
      const pass = animal.sex === need.sex;
      gates.push({
        gate: "sex",
        state: pass ? "PASS" : "FAIL",
        reason: pass
          ? `Candidate sex matches required ${need.sex}.`
          : `Candidate sex ${animal.sex} does not match required ${need.sex}.`
      });
    }
  } else {
    gates.push({ gate: "sex", state: "PASS", reason: "Research need accepts either sex." });
  }

  const conditionCoverage = coverage(
    need.condition,
    [animal.condition, animal.publicSummary, animal.diseaseStage ?? ""].join(" ")
  );
  if (conditionCoverage === 0) {
    gates.push({
      gate: "condition_terminology",
      state: "REVIEW",
      reason: "No direct terminology overlap was found; scientific review is required rather than assuming mismatch."
    });
    reviewFlags.push("Review disease/condition terminology manually.");
  } else {
    gates.push({
      gate: "condition_terminology",
      state: "PASS",
      reason: "Candidate and requested condition share clinically relevant terminology."
    });
  }

  if (need.diseaseStage?.trim()) {
    if (!animal.diseaseStage?.trim()) {
      gates.push({ gate: "disease_stage", state: "REVIEW", reason: "Disease stage is not yet characterized." });
      reviewFlags.push("Confirm disease stage.");
    } else {
      const overlap = coverage(need.diseaseStage, animal.diseaseStage);
      gates.push({
        gate: "disease_stage",
        state: overlap > 0 ? "PASS" : "REVIEW",
        reason: overlap > 0
          ? "Disease-stage terminology is compatible."
          : "Disease-stage terminology differs and requires scientific review."
      });
      if (overlap === 0) reviewFlags.push("Review disease-stage compatibility.");
    }
  } else {
    gates.push({ gate: "disease_stage", state: "PASS", reason: "No disease-stage hard gate specified." });
  }

  const candidateText = [
    animal.condition,
    animal.publicSummary,
    animal.diseaseStage ?? "",
    ...animal.phenotype
  ].join(" ");

  const phenotypeFit = boundedScore(
    MATCH_WEIGHTS.phenotypeFit,
    coverage(need.requiredPhenotype, candidateText)
  );

  const diagnosticConfidence = confidenceScore(animal.diagnosticConfidence);

  const etiologyFit = boundedScore(
    MATCH_WEIGHTS.etiologyFit,
    coverage(need.condition, candidateText)
  );

  let comorbidityFit = MATCH_WEIGHTS.comorbidityFit;
  if (need.exclusionCriteria?.trim()) {
    const exclusionOverlap = coverage(need.exclusionCriteria, candidateText);
    comorbidityFit = boundedScore(MATCH_WEIGHTS.comorbidityFit, 1 - exclusionOverlap);
    if (exclusionOverlap > 0) {
      reviewFlags.push("Potential overlap with exclusion criteria.");
      reasons.push("Comorbidity score reduced because candidate text overlaps exclusion criteria.");
    }
  } else if (need.acceptableComorbidities?.trim()) {
    const acceptableOverlap = coverage(need.acceptableComorbidities, candidateText);
    comorbidityFit = Math.max(
      7,
      boundedScore(MATCH_WEIGHTS.comorbidityFit, acceptableOverlap)
    );
  }

  const needDays = parseDays(need.timeline);
  const candidateDays = parseDays(animal.availabilityText);
  let timingAvailability = 6;
  if (needDays != null && candidateDays != null) {
    if (candidateDays <= needDays) timingAvailability = MATCH_WEIGHTS.timingAvailability;
    else if (candidateDays <= needDays * 1.25) timingAvailability = 5;
    else timingAvailability = 1;
  } else {
    reviewFlags.push("Confirm timing against exact study schedule.");
  }

  const logisticsFit = animal.transportReady ? MATCH_WEIGHTS.logisticsFit : 3;
  if (!animal.transportReady) reviewFlags.push("Transport readiness remains unresolved.");

  let priceFit = 3;
  if (need.budgetCents != null && animal.listPriceCents != null) {
    if (animal.listPriceCents <= need.budgetCents) priceFit = MATCH_WEIGHTS.priceFit;
    else if (animal.listPriceCents <= need.budgetCents * 1.1) priceFit = 3;
    else if (animal.listPriceCents <= need.budgetCents * 1.25) priceFit = 1;
    else priceFit = 0;
  } else {
    reviewFlags.push("Budget/price fit is provisional.");
  }

  const components: MatchComponents = {
    phenotypeFit,
    diagnosticConfidence,
    etiologyFit,
    comorbidityFit,
    timingAvailability,
    logisticsFit,
    priceFit
  };

  reasons.push(
    `Phenotype fit ${phenotypeFit}/${MATCH_WEIGHTS.phenotypeFit}.`,
    `Diagnostic confidence ${diagnosticConfidence}/${MATCH_WEIGHTS.diagnosticConfidence}.`,
    `Etiology fit ${etiologyFit}/${MATCH_WEIGHTS.etiologyFit}.`,
    `Comorbidity fit ${comorbidityFit}/${MATCH_WEIGHTS.comorbidityFit}.`,
    `Timing fit ${timingAvailability}/${MATCH_WEIGHTS.timingAvailability}.`,
    `Logistics fit ${logisticsFit}/${MATCH_WEIGHTS.logisticsFit}.`,
    `Price fit ${priceFit}/${MATCH_WEIGHTS.priceFit}.`
  );

  const eligible = !gates.some((gate) => gate.state === "FAIL");
  const totalScore = eligible
    ? Object.values(components).reduce((sum, score) => sum + score, 0)
    : 0;

  return {
    animalCaseId: animal.id,
    researchNeedId: need.id,
    eligible,
    totalScore,
    components,
    hardGates: gates,
    reviewFlags: [...new Set(reviewFlags)],
    reasons
  };
}

export function rankMatches(animals: MatchAnimal[], need: MatchNeed) {
  return animals
    .map((animal) => scoreMatch(animal, need))
    .filter((match) => match.eligible)
    .sort((a, b) => b.totalScore - a.totalScore);
}
