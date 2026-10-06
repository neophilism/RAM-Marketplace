const BUYER_FORBIDDEN_KEYS = new Set([
  "supplierPricingPolicyId",
  "supplierScheduleCents",
  "supplierMarketCeilingCents",
  "supplierAcquisitionCents",
  "farmSiteId",
  "sourceFarmName",
  "sourceExactAddress",
  "pickupAddress",
  "pickupContactName",
  "pickupContactEmail",
  "legalOwnerName",
  "ownerContactName",
  "ownerContactEmail",
  "localVetName",
  "localVetContact"
]);

const ACQUISITION_DECISION_FORBIDDEN_KEYS = new Set([
  "buyerOrganizationId",
  "buyerOrganizationName",
  "buyerPriceCents",
  "buyerPriceComponents",
  "buyerBudgetCents",
  "matchScore"
]);

function assertNoForbiddenKeys(
  record: Record<string, unknown>,
  forbidden: ReadonlySet<string>,
  boundary: string
) {
  for (const key of Object.keys(record)) {
    if (forbidden.has(key)) {
      throw new Error(`${boundary} privacy boundary violated by key: ${key}`);
    }
  }
}

export function assertBuyerOrderProjection(record: Record<string, unknown>) {
  assertNoForbiddenKeys(record, BUYER_FORBIDDEN_KEYS, "Buyer order");
}

export function assertBlindAcquisitionProjection(record: Record<string, unknown>) {
  assertNoForbiddenKeys(
    record,
    ACQUISITION_DECISION_FORBIDDEN_KEYS,
    "Supplier acquisition decision"
  );
}
