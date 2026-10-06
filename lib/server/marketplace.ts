import "server-only";
import type { AnimalListing } from "@/lib/domain";
import {
  assertAnonymousMarketplaceRecord,
  toMarketplaceListing
} from "@/lib/marketplace-projection";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import { expireStaleHolds } from "@/lib/server/transactions";
import { restrictedAnimalRecords } from "@/lib/server/restricted-demo-data";

function confidence(value: string | null): AnimalListing["diagnosticConfidence"] {
  if (value === "Confirmed" || value === "High" || value === "Moderate") return value;
  return "Moderate";
}

function sex(value: string | null): AnimalListing["sex"] {
  if (value === "Female" || value === "Male" || value === "Unknown") return value;
  return "Unknown";
}

function ageLabel(months: number | null) {
  if (months === null) return "Age not disclosed";
  if (months < 24) return `${months} months`;
  const years = months / 12;
  return `${Number.isInteger(years) ? years : years.toFixed(1)} years`;
}

export async function getMarketplaceListings(): Promise<AnimalListing[]> {
  await expireStaleHolds();

  if (dataBackend() === "prototype") {
    return restrictedAnimalRecords.map((record) => {
      const listing = toMarketplaceListing(record);
      assertAnonymousMarketplaceRecord(listing as unknown as Record<string, unknown>);
      return listing;
    });
  }

  const prisma = requirePrisma();

  // Deliberately select only marketplace-safe AnimalCase columns.
  // No source-record relation is joined here.
  const rows = await prisma.animalCase.findMany({
    where: {
      status: "MATCHABLE",
      sourceDisclosure: { not: "RAM_INTERNAL_ONLY" }
    },
    orderBy: { updatedAt: "desc" },
    select: {
      publicId: true,
      species: true,
      breed: true,
      sex: true,
      ageMonths: true,
      weightKg: true,
      condition: true,
      phenotype: true,
      diseaseStage: true,
      etiology: true,
      diagnosticConfidence: true,
      comorbidities: true,
      diagnosticEvidence: true,
      regionLabel: true,
      availabilityText: true,
      listPriceCents: true,
      sourceDisclosure: true,
      transportReady: true,
      publicSummary: true
    }
  });

  return rows.map((row) => {
    const listing: AnimalListing = {
      id: row.publicId,
      species: row.species,
      breed: row.breed ?? "Not disclosed",
      sex: sex(row.sex),
      age: ageLabel(row.ageMonths),
      weightKg: row.weightKg ?? 0,
      condition: row.condition,
      phenotype: Array.isArray(row.phenotype)
        ? row.phenotype.filter((item): item is string => typeof item === "string")
        : [],
      diseaseStage: row.diseaseStage ?? "Not specified",
      etiology: row.etiology ?? undefined,
      diagnosticConfidence: confidence(row.diagnosticConfidence),
      comorbidities: Array.isArray(row.comorbidities)
        ? row.comorbidities.filter((item): item is string => typeof item === "string")
        : [],
      diagnosticEvidence: Array.isArray(row.diagnosticEvidence)
        ? row.diagnosticEvidence.filter((item): item is string => typeof item === "string")
        : [],
      region: row.regionLabel,
      availability: row.availabilityText ?? "Contact RAM",
      priceUsd: Math.round((row.listPriceCents ?? 0) / 100),
      ramVerified: true,
      sourceDisclosure: row.sourceDisclosure,
      transportReady: row.transportReady,
      summary: row.publicSummary
    };
    assertAnonymousMarketplaceRecord(listing as unknown as Record<string, unknown>);
    return listing;
  });
}

export async function getMarketplaceListing(id: string) {
  const listings = await getMarketplaceListings();
  return listings.find((listing) => listing.id === id);
}
