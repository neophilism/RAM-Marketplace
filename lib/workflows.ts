import type { AnimalCaseStatus } from "@/lib/domain";

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

const animalTransitions: Record<AnimalCaseStatus, readonly AnimalCaseStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["TRIAGE", "DRAFT"],
  TRIAGE: ["VET_REVIEW", "CLOSED"],
  VET_REVIEW: ["DIAGNOSTICS", "VERIFIED", "CLOSED"],
  DIAGNOSTICS: ["VET_REVIEW", "VERIFIED", "CLOSED"],
  VERIFIED: ["AVAILABLE", "CLOSED"],
  AVAILABLE: ["RESERVED", "CLOSED"],
  RESERVED: ["AVAILABLE", "RESEARCH_CLEARANCE", "CLOSED"],
  RESEARCH_CLEARANCE: ["RESERVED", "CONTRACTED", "CLOSED"],
  CONTRACTED: ["IN_TRANSIT", "ACTIVE_STUDY", "CLOSED"],
  IN_TRANSIT: ["ACTIVE_STUDY", "CLOSED"],
  ACTIVE_STUDY: ["COMPLETED", "CLOSED"],
  COMPLETED: ["CLOSED"],
  CLOSED: []
};

const researchTransitions: Record<ResearchNeedStatus, readonly ResearchNeedStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["VERIFIED", "DRAFT", "CLOSED"],
  VERIFIED: ["ACTIVE", "CLOSED"],
  ACTIVE: ["MATCH_REVIEW", "CLOSED"],
  MATCH_REVIEW: ["ACTIVE", "SELECTED", "CLOSED"],
  SELECTED: ["MATCH_REVIEW", "INSTITUTIONAL_CLEARANCE", "CLOSED"],
  INSTITUTIONAL_CLEARANCE: ["SELECTED", "ORDERED", "CLOSED"],
  ORDERED: ["IN_STUDY", "CLOSED"],
  IN_STUDY: ["COMPLETED", "CLOSED"],
  COMPLETED: ["CLOSED"],
  CLOSED: []
};

export function canTransitionAnimal(from: AnimalCaseStatus, to: AnimalCaseStatus) {
  return animalTransitions[from].includes(to);
}

export function canTransitionResearchNeed(from: ResearchNeedStatus, to: ResearchNeedStatus) {
  return researchTransitions[from].includes(to);
}

export function requireAnimalTransition(from: AnimalCaseStatus, to: AnimalCaseStatus) {
  if (!canTransitionAnimal(from, to)) {
    throw new Error(`Invalid animal case transition: ${from} -> ${to}`);
  }
}

export function requireResearchNeedTransition(from: ResearchNeedStatus, to: ResearchNeedStatus) {
  if (!canTransitionResearchNeed(from, to)) {
    throw new Error(`Invalid research need transition: ${from} -> ${to}`);
  }
}
