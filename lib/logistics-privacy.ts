const TRANSPORT_FORBIDDEN_KEYS = new Set([
  "buyerPriceCents",
  "buyerPriceComponents",
  "buyerBudgetCents",
  "supplierPricingPolicyId",
  "supplierScheduleCents",
  "supplierMarketCeilingCents",
  "supplierAcquisitionCents",
  "legalOwnerName",
  "sourceFarmName",
  "localVetName",
  "localVetContact",
  "researchNeedTitle",
  "scientificRationale",
  "matchScore"
]);

export function assertTransportPacketProjection(record: Record<string, unknown>) {
  for (const key of Object.keys(record)) {
    if (TRANSPORT_FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Transport packet privacy boundary violated by key: ${key}`);
    }
  }
}
