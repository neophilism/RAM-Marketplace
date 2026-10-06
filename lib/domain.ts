export const CANDIDATE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PRE_SCREENED",
  "VET_PENDING",
  "VERIFIED",
  "MATCHABLE",
  "RESERVED",
  "SOLD_TO_RAM",
  "TRANSFERRED",
  "WITHDRAWN",
  "CULLED",
  "EXPIRED",
  "INELIGIBLE",
  "QUARANTINED",
  "SUSPENDED"
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "CANDIDATE_HELD",
  "CHECKOUT_PENDING",
  "BUYER_COMMITTED",
  "ACQUISITION_COMMITTED",
  "CLEARANCE_PENDING",
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "DELIVERED",
  "ACCEPTED",
  "SETTLED",
  "CLOSED",
  "EXPIRED",
  "CLEARANCE_FAILED",
  "SUPPLIER_WITHDRAWN",
  "BUYER_CANCELLED",
  "TRANSPORT_EXCEPTION",
  "REJECTED_AT_RECEIPT",
  "DISPUTED"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DISCLOSURE_TIERS = [
  "PUBLIC_ANONYMIZED",
  "REQUESTABLE",
  "POST_RESERVATION",
  "POST_PURCHASE",
  "RAM_INTERNAL_ONLY"
] as const;

export type DisclosureTier = (typeof DISCLOSURE_TIERS)[number];

export interface AnimalListing {
  id: string;
  species: string;
  breed: string;
  sex: "Female" | "Male" | "Unknown";
  age: string;
  weightKg: number;
  condition: string;
  phenotype: string[];
  diseaseStage: string;
  etiology?: string;
  diagnosticConfidence: "Confirmed" | "High" | "Moderate";
  comorbidities: string[];
  diagnosticEvidence: string[];
  region: string;
  availability: string;
  priceUsd: number;
  ramVerified: boolean;
  sourceDisclosure: DisclosureTier;
  transportReady: boolean;
  summary: string;
}

export const MATCH_WEIGHTS = {
  phenotypeFit: 30,
  diagnosticConfidence: 20,
  etiologyFit: 15,
  comorbidityFit: 10,
  timingAvailability: 10,
  logisticsFit: 10,
  priceFit: 5
} as const;
