import { describe, expect, it } from "vitest";
import { MARKETPLACE_FORBIDDEN_KEYS, assertAnonymousMarketplaceRecord, toMarketplaceListing } from "@/lib/marketplace-projection";

const restricted = {
  publicId: "RAM-SW-0001",
  species: "Swine",
  breed: "Yorkshire cross",
  sex: "Female" as const,
  age: "18 months",
  weightKg: 118,
  condition: "Hearing loss",
  phenotype: ["Bilateral threshold elevation"],
  diseaseStage: "Moderate",
  diagnosticConfidence: "Confirmed" as const,
  generalizedRegion: "Midwest U.S.",
  availability: "14 days",
  priceUsd: 7800,
  sourceDisclosure: "REQUESTABLE" as const,
  transportReady: true,
  publicSummary: "Naturally occurring hearing loss.",
  farmId: "farm-secret",
  farmLegalName: "Secret Farm LLC",
  exactAddress: "123 Secret Road",
  ownerName: "Private Owner",
  ownerEmail: "private@example.test",
  veterinarianName: "Private Vet",
  privateNotes: "Never disclose this."
};

describe("marketplace privacy projection", () => {
  it("never exposes restricted source fields", () => {
    const listing = toMarketplaceListing(restricted);
    for (const key of MARKETPLACE_FORBIDDEN_KEYS) {
      expect(listing).not.toHaveProperty(key);
    }
    expect(() => assertAnonymousMarketplaceRecord(listing as unknown as Record<string, unknown>)).not.toThrow();
  });

  it("fails closed if a forbidden field appears", () => {
    expect(() => assertAnonymousMarketplaceRecord({ id: "RAM-1", farmLegalName: "Leak" })).toThrow(/privacy violation/i);
  });
});
