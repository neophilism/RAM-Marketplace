import "server-only";
import type { AnimalSubmissionInput, ResearchNeedInput } from "@/lib/validation";

export interface PrototypeAnimalCase {
  id: string;
  condition: string;
  status: "SUBMITTED";
  action: string;
  submittedAt: string;
}

export interface PrototypeResearchNeed {
  id: string;
  title: string;
  status: "SUBMITTED";
  matches: number;
  updated: string;
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

export function savePrototypeAnimal(input: AnimalSubmissionInput) {
  const db = store();
  db.animalSequence += 1;
  const record: PrototypeAnimalCase = {
    id: `RAM-PENDING-${db.animalSequence}`,
    condition: input.condition,
    status: "SUBMITTED",
    action: "Awaiting RAM triage",
    submittedAt: new Date().toISOString()
  };
  db.animals.unshift(record);
  return record;
}

export function getPrototypeAnimals() {
  return [...store().animals];
}

export function savePrototypeResearchNeed(input: ResearchNeedInput) {
  const db = store();
  db.researchSequence += 1;
  const record: PrototypeResearchNeed = {
    id: `RN-${String(db.researchSequence).padStart(5, "0")}`,
    title: input.title,
    status: "SUBMITTED",
    matches: 0,
    updated: "Just now"
  };
  db.researchNeeds.unshift(record);
  return record;
}

export function getPrototypeResearchNeeds() {
  return [...store().researchNeeds];
}
