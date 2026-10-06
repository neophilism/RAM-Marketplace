import {
  calculateBuyerPriceCents,
  calculateSupplierAcquisitionPriceCents
} from "./pricing";

export const DEFAULT_HOLD_HOURS = 24;
export const DEFAULT_QUOTE_HOURS = 24;

export interface QuoteSnapshot {
  buyerPriceCents: number;
  buyerPriceComponents: {
    baseModelCents: number;
    characterizationCents: number;
    diagnosticsCents: number;
    logisticsCents: number;
    serviceCents: number;
  };
}

export function createQuoteSnapshot(
  baseModelCents: number,
  extras?: Partial<Omit<QuoteSnapshot["buyerPriceComponents"], "baseModelCents">>
): QuoteSnapshot {
  const components = {
    baseModelCents,
    characterizationCents: extras?.characterizationCents ?? 0,
    diagnosticsCents: extras?.diagnosticsCents ?? 0,
    logisticsCents: extras?.logisticsCents ?? 0,
    serviceCents: extras?.serviceCents ?? 0
  };

  return {
    buyerPriceCents: calculateBuyerPriceCents(components),
    buyerPriceComponents: components
  };
}

export function calculateIndependentSupplierCommitment(input: {
  standardizedCullScheduleCents: number;
  marketCeilingCents: number;
}) {
  return calculateSupplierAcquisitionPriceCents({
    standardizedCullScheduleCents: input.standardizedCullScheduleCents,
    marketCeilingCents: input.marketCeilingCents
  });
}

export function expiresAt(hours: number, now = new Date()) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function isExpired(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return false;
  return new Date(value).getTime() <= now.getTime();
}

export interface ClearanceChecks {
  protocolConfirmed: boolean;
  receivingFacilityConfirmed: boolean;
  welfareConfirmed: boolean;
  biosecurityConfirmed: boolean;
  movementRequirementsConfirmed: boolean;
  transportPlanConfirmed: boolean;
  sourceProvenanceConfirmed: boolean;
}

export function countBlockingClearanceFindings(
  checks: ClearanceChecks,
  explicitFindings: string[] = []
) {
  const missing = Object.values(checks).filter((confirmed) => !confirmed).length;
  return missing + explicitFindings.filter((finding) => finding.trim().length > 0).length;
}
