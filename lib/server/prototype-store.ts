import "server-only";
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
  diagnosticConfidence?: string;
  phenotype: string[];
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
  animalSequence: number;
  researchSequence: number;
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
      animalSequence: 2000,
      researchSequence: 200
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
