import type { OrderStatus } from "./domain";
import { calculateSupplierAcquisitionPriceCents } from "./pricing";

export const FINANCIAL_MOVEMENT_TYPES = [
  "BUYER_PAYMENT",
  "SUPPLIER_PAYOUT",
  "BUYER_CREDIT",
  "BUYER_REFUND"
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
  const buyerCreditsCents = movements
    .filter((entry) => entry.type === "BUYER_CREDIT")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const buyerRefundedCents = movements
    .filter((entry) => entry.type === "BUYER_REFUND")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const supplierPaidCents = movements
    .filter((entry) => entry.type === "SUPPLIER_PAYOUT")
    .reduce((sum, entry) => sum + entry.amountCents, 0);

  for (const [name, value] of [
    ["buyerPaidCents", buyerPaidCents],
    ["buyerCreditsCents", buyerCreditsCents],
    ["buyerRefundedCents", buyerRefundedCents],
    ["supplierPaidCents", supplierPaidCents]
  ] as const) {
    assertNonNegativeInteger(name, value);
  }

  if (buyerCreditsCents > snapshot.buyerReceivableCents) {
    throw new Error("Buyer credits exceed the original receivable");
  }
  if (buyerRefundedCents > buyerPaidCents) {
    throw new Error("Buyer refunds exceed recorded buyer payments");
  }
  if (supplierPaidCents > snapshot.supplierPayableCents) {
    throw new Error("Supplier payouts exceed the committed payable");
  }

  const effectiveBuyerReceivableCents =
    snapshot.buyerReceivableCents - buyerCreditsCents;
  const buyerNetPaidCents = buyerPaidCents - buyerRefundedCents;
  const buyerOutstandingCents = Math.max(
    effectiveBuyerReceivableCents - buyerNetPaidCents,
    0
  );
  const buyerRefundDueCents = Math.max(
    buyerNetPaidCents - effectiveBuyerReceivableCents,
    0
  );

  return {
    buyerPaidCents,
    buyerCreditsCents,
    buyerRefundedCents,
    buyerNetPaidCents,
    effectiveBuyerReceivableCents,
    buyerCreditAvailableCents:
      snapshot.buyerReceivableCents - buyerCreditsCents,
    buyerOutstandingCents,
    buyerRefundDueCents,
    supplierPaidCents,
    supplierOutstandingCents:
      snapshot.supplierPayableCents - supplierPaidCents
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

  let available: number;
  if (type === "BUYER_PAYMENT") {
    available = balances.buyerOutstandingCents;
  } else if (type === "SUPPLIER_PAYOUT") {
    available = balances.supplierOutstandingCents;
  } else if (type === "BUYER_CREDIT") {
    available = balances.buyerCreditAvailableCents;
  } else {
    available = balances.buyerRefundDueCents;
  }

  if (amountCents > available) {
    throw new Error("Financial movement exceeds the available balance");
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
    balances.buyerRefundDueCents !== 0 ||
    balances.supplierOutstandingCents !== 0
  ) {
    throw new Error("All buyer and supplier balances must be satisfied before settlement");
  }
}

export function assertDisputeFinancialResolutionReady(
  orderStatus: OrderStatus,
  balances: ReturnType<typeof financialBalances>
) {
  if (orderStatus !== "DISPUTED") {
    throw new Error("Dispute financial resolution requires a disputed order");
  }
  if (
    balances.buyerOutstandingCents !== 0 ||
    balances.buyerRefundDueCents !== 0 ||
    balances.supplierOutstandingCents !== 0
  ) {
    throw new Error("All dispute balances must be resolved before financial settlement");
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
