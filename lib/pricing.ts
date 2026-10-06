export interface SupplierAcquisitionPolicy {
  standardizedCullScheduleCents: number;
  marketCeilingCents: number;
}

export interface BuyerPriceComponents {
  baseModelCents: number;
  characterizationCents?: number;
  diagnosticsCents?: number;
  urgencyCents?: number;
  logisticsCents?: number;
  serviceCents?: number;
  corridorRiskAdjustmentCents?: number;
}

function assertNonNegativeCents(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer number of cents`);
  }
}

/**
 * Supplier acquisition pricing is deliberately blind to diagnosis, severity,
 * rarity, match score, buyer identity, buyer budget, and buyer sale price.
 */
export function calculateSupplierAcquisitionPriceCents(
  policy: SupplierAcquisitionPolicy
): number {
  assertNonNegativeCents("standardizedCullScheduleCents", policy.standardizedCullScheduleCents);
  assertNonNegativeCents("marketCeilingCents", policy.marketCeilingCents);
  return Math.min(policy.standardizedCullScheduleCents, policy.marketCeilingCents);
}

/**
 * Buyer-side pricing is a separate calculation. No value from this function
 * is accepted by calculateSupplierAcquisitionPriceCents.
 */
export function calculateBuyerPriceCents(components: BuyerPriceComponents): number {
  const entries = Object.entries(components) as Array<[string, number | undefined]>;
  for (const [name, value] of entries) {
    if (value !== undefined) assertNonNegativeCents(name, value);
  }

  return entries.reduce((total, [, value]) => total + (value ?? 0), 0);
}

export function calculateGrossSpreadCents(
  buyerPriceCents: number,
  supplierAcquisitionCents: number,
  directCostsCents: number
): number {
  assertNonNegativeCents("buyerPriceCents", buyerPriceCents);
  assertNonNegativeCents("supplierAcquisitionCents", supplierAcquisitionCents);
  assertNonNegativeCents("directCostsCents", directCostsCents);
  return buyerPriceCents - supplierAcquisitionCents - directCostsCents;
}
