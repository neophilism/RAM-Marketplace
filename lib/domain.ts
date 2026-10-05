export type AnimalCaseStatus =
  | "DRAFT" | "SUBMITTED" | "TRIAGE" | "VET_REVIEW" | "DIAGNOSTICS"
  | "VERIFIED" | "AVAILABLE" | "RESERVED" | "RESEARCH_CLEARANCE"
  | "CONTRACTED" | "IN_TRANSIT" | "ACTIVE_STUDY" | "COMPLETED" | "CLOSED";

export type DisclosureTier =
  | "PUBLIC_ANONYMIZED" | "REQUESTABLE" | "POST_RESERVATION"
  | "POST_PURCHASE" | "RAM_INTERNAL_ONLY";

export interface AnimalListing {
  id: string;
  species: string;
  breed: string;
  sex: "Female" | "Male";
  age: string;
  weightKg: number;
  condition: string;
  phenotype: string[];
  diseaseStage: string;
  diagnosticConfidence: "Confirmed" | "High" | "Moderate";
  region: string;
  availability: string;
  priceUsd: number;
  ramVerified: boolean;
  sourceDisclosure: DisclosureTier;
  transportReady: boolean;
  summary: string;
}

export const MATCH_WEIGHTS = {
  phenotype: 30,
  etiology: 20,
  stage: 15,
  diagnostics: 10,
  comorbidities: 10,
  demographics: 5,
  logistics: 5,
  studyFit: 5
} as const;
