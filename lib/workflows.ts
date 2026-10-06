export type ResearchNeedStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VERIFIED"
  | "ACTIVE"
  | "MATCH_REVIEW"
  | "SELECTED"
  | "INSTITUTIONAL_CLEARANCE"
  | "ORDERED"
  | "IN_STUDY"
  | "COMPLETED"
  | "CLOSED";

const researchTransitions: Record<ResearchNeedStatus, readonly ResearchNeedStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["VERIFIED", "DRAFT", "CLOSED"],
  VERIFIED: ["ACTIVE", "CLOSED"],
  ACTIVE: ["MATCH_REVIEW", "CLOSED"],
  MATCH_REVIEW: ["ACTIVE", "SELECTED", "CLOSED"],
  SELECTED: ["MATCH_REVIEW", "INSTITUTIONAL_CLEARANCE", "CLOSED"],
  INSTITUTIONAL_CLEARANCE: ["SELECTED", "ORDERED", "CLOSED"],
  ORDERED: ["ACTIVE", "IN_STUDY", "CLOSED"],
  IN_STUDY: ["COMPLETED", "CLOSED"],
  COMPLETED: ["CLOSED"],
  CLOSED: []
};

export function canTransitionResearchNeed(from: ResearchNeedStatus, to: ResearchNeedStatus) {
  return researchTransitions[from].includes(to);
}

export function requireResearchNeedTransition(from: ResearchNeedStatus, to: ResearchNeedStatus) {
  if (!canTransitionResearchNeed(from, to)) {
    throw new Error(`Invalid research need transition: ${from} -> ${to}`);
  }
}
