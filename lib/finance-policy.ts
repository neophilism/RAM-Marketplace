import type { OrderStatus } from "./domain";
import { calculateSupplierAcquisitionPriceCents } from "./pricing";

export const FINANCIAL_MOVEMENT_TYPES = [
  "BUYER_PAYMENT",
  "SUPPLIER_PAYOUT"
] as const;

export type FinancialMovementType = (typeof FINANCIAL_MOVEMENT_TYPES)[number];

export interface FinancialSnapshot {
  buyerReceivableCents: number;
  supplierPayableCents: number;
  supplierScheduleCents: number;
  supplierMarketCeilingCents: number;
  directCostsCents: number;
}

export interface FinancialMovement {
  type: FinancialMovementType;
  amountCents: number;
}

function assertNonNegativeInteger(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer number of cents`);
  }
}

export function assertFinancialSnapshot(snapshot: FinancialSnapshot) {
  assertNonNegativeInteger("buyerReceivableCents", snapshot.buyerReceivableCents);
  assertNonNegativeInteger("supplierPayableCents", snapshot.supplierPayableCents);
  assertNonNegativeInteger("supplierScheduleCents", snapshot.supplierScheduleCents);
  assertNonNegativeInteger(
    "supplierMarketCeilingCents",
    snapshot.supplierMarketCeilingCents
  );
  assertNonNegativeInteger("directCostsCents", snapshot.directCostsCents);

  const expectedSupplierPayable = calculateSupplierAcquisitionPriceCents({
    standardizedCullScheduleCents: snapshot.supplierScheduleCents,
    marketCeilingCents: snapshot.supplierMarketCeilingCents
  });

  if (snapshot.supplierPayableCents !== expectedSupplierPayable) {
    throw new Error(
      "Supplier payable must equal the independently snapshotted acquisition amount"
    );
  }
}

export function financialBalances(
  snapshot: Pick<FinancialSnapshot, "buyerReceivableCents" | "supplierPayableCents">,
  movements: readonly FinancialMovement[]
) {
  const buyerPaidCents = movements
    .filter((entry) => entry.type === "BUYER_PAYMENT")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const supplierPaidCents = movements
    .filter((entry) => entry.type === "SUPPLIER_PAYOUT")
    .reduce((sum, entry) => sum + entry.amountCents, 0);

  for (const [name, value] of [
    ["buyerPaidCents", buyerPaidCents],
    ["supplierPaidCents", supplierPaidCents]
  ] as const) {
    assertNonNegativeInteger(name, value);
  }

  if (buyerPaidCents > snapshot.buyerReceivableCents) {
    throw new Error("Buyer payments exceed the receivable");
  }
  if (supplierPaidCents > snapshot.supplierPayableCents) {
    throw new Error("Supplier payouts exceed the committed payable");
  }

  return {
    buyerPaidCents,
    supplierPaidCents,
    buyerOutstandingCents: snapshot.buyerReceivableCents - buyerPaidCents,
    supplierOutstandingCents: snapshot.supplierPayableCents - supplierPaidCents
  };
}

export function assertMovementWithinOutstanding(
  type: FinancialMovementType,
  amountCents: number,
  balances: ReturnType<typeof financialBalances>
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Financial movement must be a positive integer number of cents");
  }

  const outstanding =
    type === "BUYER_PAYMENT"
      ? balances.buyerOutstandingCents
      : balances.supplierOutstandingCents;

  if (amountCents > outstanding) {
    throw new Error("Financial movement exceeds the outstanding balance");
  }
}

export function assertSettlementReady(
  orderStatus: OrderStatus,
  balances: ReturnType<typeof financialBalances>
) {
  if (orderStatus !== "ACCEPTED") {
    throw new Error("Financial settlement may finalize only after buyer acceptance");
  }
  if (
    balances.buyerOutstandingCents !== 0 ||
    balances.supplierOutstandingCents !== 0
  ) {
    throw new Error("All buyer and supplier balances must be satisfied before settlement");
  }
}

export function assertReconciliationCloseReady(
  orderStatus: OrderStatus,
  settlementStatus: "OPEN" | "SETTLED" | "CLOSED"
) {
  if (orderStatus !== "SETTLED" || settlementStatus !== "SETTLED") {
    throw new Error("Only a settled order may be closed after reconciliation");
  }
}
