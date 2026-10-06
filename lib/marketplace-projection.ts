import type { AnimalListing } from "@/lib/domain";

export interface RestrictedAnimalRecord {
  publicId: string;
  species: string;
  breed: string;
  sex: "Female" | "Male";
  age: string;
  weightKg: number;
  condition: string;
  phenotype: string[];
  diseaseStage: string;
  etiology?: string;
  diagnosticConfidence: "Confirmed" | "High" | "Moderate";
  comorbidities?: string[];
  diagnosticEvidence?: string[];
  generalizedRegion: string;
  availability: string;
  priceUsd: number;
  sourceDisclosure: AnimalListing["sourceDisclosure"];
  transportReady: boolean;
  publicSummary: string;

  // Restricted source layer. These fields must never enter a marketplace response.
  farmId: string;
  farmLegalName: string;
  exactAddress: string;
  ownerName: string;
  ownerEmail: string;
  veterinarianName?: string;
  privateNotes?: string;
}

export const MARKETPLACE_FORBIDDEN_KEYS = [
  "farmId",
  "farmLegalName",
  "exactAddress",
  "ownerName",
  "ownerEmail",
  "veterinarianName",
  "privateNotes"
] as const;

export function toMarketplaceListing(record: RestrictedAnimalRecord): AnimalListing {
  return {
    id: record.publicId,
    species: record.species,
    breed: record.breed,
    sex: record.sex,
    age: record.age,
    weightKg: record.weightKg,
    condition: record.condition,
    phenotype: [...record.phenotype],
    diseaseStage: record.diseaseStage,
    etiology: record.etiology,
    diagnosticConfidence: record.diagnosticConfidence,
    comorbidities: [...(record.comorbidities ?? [])],
    diagnosticEvidence: [...(record.diagnosticEvidence ?? [])],
    region: record.generalizedRegion,
    availability: record.availability,
    priceUsd: record.priceUsd,
    ramVerified: record.diagnosticConfidence === "Confirmed" || record.diagnosticConfidence === "High",
    sourceDisclosure: record.sourceDisclosure,
    transportReady: record.transportReady,
    summary: record.publicSummary
  };
}

export function assertAnonymousMarketplaceRecord(value: Record<string, unknown>) {
  for (const key of MARKETPLACE_FORBIDDEN_KEYS) {
    if (key in value) throw new Error(`Marketplace privacy violation: forbidden key ${key}`);
  }
  return value;
}
