import type { CandidateStatus } from "./domain";

export type VeterinaryOutcome =
  | "NEEDS_DIAGNOSTICS"
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "WELFARE_HOLD";

export function candidateStatusForVeterinaryOutcome(
  outcome: VeterinaryOutcome
): CandidateStatus {
  switch (outcome) {
    case "ELIGIBLE":
      return "VERIFIED";
    case "INELIGIBLE":
      return "INELIGIBLE";
    case "WELFARE_HOLD":
      return "SUSPENDED";
    case "NEEDS_DIAGNOSTICS":
      return "VET_PENDING";
  }
}

export function phenotypeLines(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}
