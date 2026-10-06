import "server-only";
import type { ExplainableMatch } from "@/lib/matching";
import type {
  AnimalSubmissionInput,
  ResearchNeedInput,
  VeterinaryReviewInput
} from "@/lib/validation";

export interface PrototypeAnimalCase {
  id: string;
  species: string;
  sex: string;
  ageMonths?: number;
  condition: string;
  diseaseStage?: string;
  etiology?: string;
  diagnosticConfidence?: string;
  phenotype: string[];
  comorbidities: string[];
  diagnosticEvidence: string[];
  publicSummary: string;
  status: string;
  action: string;
  submittedAt: string;
  listPriceCents?: number;
  transportReady: boolean;
  availabilityText?: string;
  vetReviewerUserId?: string;
  veterinaryReview?: VeterinaryReviewInput;
  input: AnimalSubmissionInput;
}

export interface PrototypeOrderClearance {
  decision: "PENDING" | "CLEARED" | "FAILED";
  protocolConfirmed: boolean;
  receivingFacilityConfirmed: boolean;
  welfareConfirmed: boolean;
  biosecurityConfirmed: boolean;
  movementRequirementsConfirmed: boolean;
  transportPlanConfirmed: boolean;
  sourceProvenanceConfirmed: boolean;
  blockingFindings: string[];
  notes?: string;
  reviewerUserId?: string;
  reviewedAt?: string;
}

export interface PrototypeOrder {
  id: string;
  animalCaseId: string;
  buyerOrganizationId: string;
  researchNeedId: string;
  createdByUserId: string;
  status: string;
  buyerPriceCents?: number;
  buyerPriceComponents?: Record<string, number>;
  supplierPricingPolicyId?: string;
  supplierScheduleCents?: number;
  supplierMarketCeilingCents?: number;
  supplierAcquisitionCents?: number;
  directCostsCents: number;
  holdExpiresAt?: string;
  quoteIssuedAt?: string;
  quoteExpiresAt?: string;
  buyerCommittedAt?: string;
  acquisitionCommittedAt?: string;
  clearanceStartedAt?: string;
  clearedAt?: string;
  receivingFacilityName?: string;
  receivingFacilityAddress?: string;
  protocolReference?: string;
  institutionalApprovalAttested: boolean;
  purchasingAuthorityAttested: boolean;
  clearance?: PrototypeOrderClearance;
  createdAt: string;
  updatedAt: string;
}

export interface PrototypeSupplierPricingPolicy {
  id: string;
  species: string;
  standardizedCullScheduleCents: number;
  marketCeilingCents: number;
  active: boolean;
  effectiveFrom: string;
  createdByUserId: string;
}

export interface PrototypeResearchNeed {
  id: string;
  title: string;
  status: string;
  matches: number;
  updated: string;
  input: ResearchNeedInput;
}

interface PrototypeStore {
  animals: PrototypeAnimalCase[];
  researchNeeds: PrototypeResearchNeed[];
  matches: ExplainableMatch[];
  orders: PrototypeOrder[];
  pricingPolicies: PrototypeSupplierPricingPolicy[];
  animalSequence: number;
  researchSequence: number;
  orderSequence: number;
  pricingPolicySequence: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __ramPrototypeStore: PrototypeStore | undefined;
}

function store(): PrototypeStore {
  if (!globalThis.__ramPrototypeStore) {
    globalThis.__ramPrototypeStore = {
      animals: [],
      researchNeeds: [],
      matches: [],
      orders: [],
      pricingPolicies: [],
      animalSequence: 2000,
      researchSequence: 200,
      orderSequence: 300,
      pricingPolicySequence: 10
    };
  }
  return globalThis.__ramPrototypeStore;
}

function actionForStatus(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "Awaiting RAM pre-screen";
    case "PRE_SCREENED":
      return "Ready for veterinary claim";
    case "VET_PENDING":
      return "Veterinary review in progress";
    case "VERIFIED":
      return "Awaiting RAM publication";
    case "MATCHABLE":
      return "Available for research matching";
    case "INELIGIBLE":
      return "Closed as ineligible";
    case "SUSPENDED":
      return "Welfare / integrity hold";
    default:
      return status.replaceAll("_", " ").toLowerCase();
  }
}

export function savePrototypeAnimal(input: AnimalSubmissionInput) {
  const db = store();
  db.animalSequence += 1;
  const record: PrototypeAnimalCase = {
    id: `RAM-PENDING-${db.animalSequence}`,
    species: input.species,
    sex: input.sex,
    ageMonths: input.ageMonths,
    condition: input.condition,
    diseaseStage: input.diseaseStage,
    phenotype: [],
    comorbidities: [],
    diagnosticEvidence: [],
    publicSummary: "Submitted for RAM veterinary characterization; not yet marketable.",
    status: "SUBMITTED",
    action: "Awaiting RAM pre-screen",
    submittedAt: new Date().toISOString(),
    transportReady: false,
    input
  };
  db.animals.unshift(record);
  return record;
}

export function getPrototypeAnimals() {
  return [...store().animals];
}

export function getPrototypeAnimal(id: string) {
  return store().animals.find((animal) => animal.id === id);
}

export function updatePrototypeAnimal(
  id: string,
  patch: Partial<Omit<PrototypeAnimalCase, "id" | "input">>
) {
  const animal = getPrototypeAnimal(id);
  if (!animal) throw new Error("Candidate not found");
  Object.assign(animal, patch);
  animal.action = actionForStatus(animal.status);
  return animal;
}

export function savePrototypeResearchNeed(input: ResearchNeedInput) {
  const db = store();
  db.researchSequence += 1;
  const record: PrototypeResearchNeed = {
    id: `RN-${String(db.researchSequence).padStart(5, "0")}`,
    title: input.title,
    status: "SUBMITTED",
    matches: 0,
    updated: "Just now",
    input
  };
  db.researchNeeds.unshift(record);
  return record;
}

export function getPrototypeResearchNeeds() {
  return [...store().researchNeeds];
}

export function getPrototypeResearchNeed(id: string) {
  return store().researchNeeds.find((need) => need.id === id);
}

export function updatePrototypeResearchNeed(
  id: string,
  patch: Partial<Omit<PrototypeResearchNeed, "id" | "input">>
) {
  const need = getPrototypeResearchNeed(id);
  if (!need) throw new Error("Research need not found");
  Object.assign(need, patch, { updated: "Just now" });
  return need;
}


export function replacePrototypeMatchesForNeed(
  researchNeedId: string,
  matches: ExplainableMatch[]
) {
  const db = store();
  db.matches = [
    ...db.matches.filter((match) => match.researchNeedId !== researchNeedId),
    ...matches
  ];
  const need = getPrototypeResearchNeed(researchNeedId);
  if (need) need.matches = matches.length;
  return matches;
}

export function getPrototypeMatchesForNeed(researchNeedId: string) {
  return store().matches
    .filter((match) => match.researchNeedId === researchNeedId)
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function replacePrototypeMatchesForAnimal(
  animalCaseId: string,
  matches: ExplainableMatch[]
) {
  const db = store();
  const affectedNeeds = new Set(matches.map((match) => match.researchNeedId));
  db.matches = [
    ...db.matches.filter((match) => match.animalCaseId !== animalCaseId),
    ...matches
  ];
  for (const needId of affectedNeeds) {
    const need = getPrototypeResearchNeed(needId);
    if (need) {
      need.matches = db.matches.filter((match) => match.researchNeedId === needId).length;
    }
  }
  return matches;
}


export function savePrototypeOrder(
  input: Omit<PrototypeOrder, "id" | "createdAt" | "updatedAt">
) {
  const db = store();
  db.orderSequence += 1;
  const now = new Date().toISOString();
  const order: PrototypeOrder = {
    ...input,
    id: `ORD-${String(db.orderSequence).padStart(6, "0")}`,
    createdAt: now,
    updatedAt: now
  };
  db.orders.unshift(order);
  return order;
}

export function getPrototypeOrders() {
  return [...store().orders];
}

export function getPrototypeOrder(id: string) {
  return store().orders.find((order) => order.id === id);
}

export function updatePrototypeOrder(
  id: string,
  patch: Partial<Omit<PrototypeOrder, "id" | "createdAt">>
) {
  const order = getPrototypeOrder(id);
  if (!order) throw new Error("Order not found");
  Object.assign(order, patch, { updatedAt: new Date().toISOString() });
  return order;
}

export function savePrototypePricingPolicy(
  input: Omit<PrototypeSupplierPricingPolicy, "id" | "effectiveFrom">
) {
  const db = store();
  for (const existing of db.pricingPolicies) {
    if (
      existing.active &&
      existing.species.toLowerCase() === input.species.toLowerCase()
    ) {
      existing.active = false;
    }
  }
  db.pricingPolicySequence += 1;
  const policy: PrototypeSupplierPricingPolicy = {
    ...input,
    id: `POL-${String(db.pricingPolicySequence).padStart(5, "0")}`,
    effectiveFrom: new Date().toISOString()
  };
  db.pricingPolicies.unshift(policy);
  return policy;
}

export function getPrototypePricingPolicies() {
  return [...store().pricingPolicies];
}

export function getPrototypeActivePricingPolicy(species: string) {
  return store().pricingPolicies
    .filter(
      (policy) =>
        policy.active &&
        policy.species.toLowerCase() === species.toLowerCase()
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
