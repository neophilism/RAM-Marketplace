import type { OrderStatus } from "./domain";
import type { ResearchNeedStatus } from "./workflows";

export const DISPUTE_RESOLUTION_TYPES = [
  "ACCEPT_AS_IS",
  "ACCEPT_WITH_CREDIT",
  "REPLACEMENT",
  "REFUND"
] as const;

export type DisputeResolutionType = (typeof DISPUTE_RESOLUTION_TYPES)[number];

export interface DisputeFinancialState {
  buyerReceivableCents: number;
  buyerCreditsCents: number;
  buyerOutstandingCents: number;
  buyerRefundDueCents: number;
  supplierOutstandingCents: number;
}

export function assertDisputeOpenable(orderStatus: OrderStatus) {
  if (orderStatus !== "REJECTED_AT_RECEIPT") {
    throw new Error("Receipt dispute may open only from a rejected receipt");
  }
}

export function disputeResolutionTarget(
  orderStatus: OrderStatus,
  researchNeedStatus: ResearchNeedStatus,
  resolutionType: DisputeResolutionType,
  finances: DisputeFinancialState
) {
  if (orderStatus !== "DISPUTED") {
    throw new Error("Dispute resolution requires a disputed order");
  }
  if (researchNeedStatus !== "ORDERED") {
    throw new Error("Rejected-receipt dispute expects the research need to remain ORDERED");
  }

  if (resolutionType === "ACCEPT_AS_IS") {
    return {
      orderStatus: "ACCEPTED" as const,
      researchNeedStatus: "IN_STUDY" as const,
      settleFinancials: false
    };
  }

  if (resolutionType === "ACCEPT_WITH_CREDIT") {
    if (finances.buyerCreditsCents <= 0) {
      throw new Error("Accept-with-credit resolution requires a recorded buyer credit");
    }
    return {
      orderStatus: "ACCEPTED" as const,
      researchNeedStatus: "IN_STUDY" as const,
      settleFinancials: false
    };
  }

  if (
    finances.buyerOutstandingCents !== 0 ||
    finances.buyerRefundDueCents !== 0 ||
    finances.supplierOutstandingCents !== 0
  ) {
    throw new Error(
      "Replacement/refund resolution requires all buyer and supplier balances to be resolved"
    );
  }

  if (
    finances.buyerCreditsCents !== finances.buyerReceivableCents
  ) {
    throw new Error(
      "Replacement/refund resolution requires a full buyer credit"
    );
  }

  return {
    orderStatus: "SETTLED" as const,
    researchNeedStatus:
      resolutionType === "REPLACEMENT"
        ? ("ACTIVE" as const)
        : ("CLOSED" as const),
    settleFinancials: true
  };
}
