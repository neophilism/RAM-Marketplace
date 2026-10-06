import type { CandidateStatus, OrderStatus } from "./domain";

const candidateTransitions: Record<CandidateStatus, readonly CandidateStatus[]> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["PRE_SCREENED", "INELIGIBLE", "WITHDRAWN", "CULLED", "EXPIRED", "SUSPENDED"],
  PRE_SCREENED: ["VET_PENDING", "INELIGIBLE", "WITHDRAWN", "CULLED", "EXPIRED", "QUARANTINED", "SUSPENDED"],
  VET_PENDING: ["VERIFIED", "INELIGIBLE", "WITHDRAWN", "CULLED", "EXPIRED", "QUARANTINED", "SUSPENDED"],
  VERIFIED: ["MATCHABLE", "INELIGIBLE", "WITHDRAWN", "CULLED", "EXPIRED", "QUARANTINED", "SUSPENDED"],
  MATCHABLE: ["RESERVED", "WITHDRAWN", "CULLED", "EXPIRED", "QUARANTINED", "SUSPENDED"],
  RESERVED: ["MATCHABLE", "SOLD_TO_RAM", "WITHDRAWN", "CULLED", "EXPIRED", "QUARANTINED", "SUSPENDED"],
  SOLD_TO_RAM: ["TRANSFERRED", "QUARANTINED", "SUSPENDED"],
  TRANSFERRED: [],
  WITHDRAWN: [],
  CULLED: [],
  EXPIRED: [],
  INELIGIBLE: [],
  QUARANTINED: ["VET_PENDING", "INELIGIBLE", "SUSPENDED"],
  SUSPENDED: ["PRE_SCREENED", "INELIGIBLE"]
};

const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["CANDIDATE_HELD", "EXPIRED", "BUYER_CANCELLED"],
  CANDIDATE_HELD: ["CHECKOUT_PENDING", "EXPIRED", "SUPPLIER_WITHDRAWN", "BUYER_CANCELLED"],
  CHECKOUT_PENDING: ["BUYER_COMMITTED", "EXPIRED", "SUPPLIER_WITHDRAWN", "BUYER_CANCELLED"],
  BUYER_COMMITTED: ["ACQUISITION_COMMITTED", "SUPPLIER_WITHDRAWN", "BUYER_CANCELLED", "DISPUTED"],
  ACQUISITION_COMMITTED: ["CLEARANCE_PENDING", "CLEARANCE_FAILED", "SUPPLIER_WITHDRAWN", "DISPUTED"],
  CLEARANCE_PENDING: ["READY_FOR_PICKUP", "CLEARANCE_FAILED", "SUPPLIER_WITHDRAWN", "DISPUTED"],
  READY_FOR_PICKUP: ["IN_TRANSIT", "TRANSPORT_EXCEPTION", "SUPPLIER_WITHDRAWN", "DISPUTED"],
  IN_TRANSIT: ["DELIVERED", "TRANSPORT_EXCEPTION", "DISPUTED"],
  DELIVERED: ["ACCEPTED", "REJECTED_AT_RECEIPT", "DISPUTED"],
  ACCEPTED: ["SETTLED", "DISPUTED"],
  SETTLED: ["CLOSED", "DISPUTED"],
  CLOSED: [],
  EXPIRED: [],
  CLEARANCE_FAILED: [],
  SUPPLIER_WITHDRAWN: [],
  BUYER_CANCELLED: [],
  TRANSPORT_EXCEPTION: ["IN_TRANSIT", "DELIVERED", "DISPUTED"],
  REJECTED_AT_RECEIPT: ["DISPUTED"],
  DISPUTED: ["ACCEPTED", "SETTLED", "CLOSED"]
};

export function canTransitionCandidate(from: CandidateStatus, to: CandidateStatus): boolean {
  return candidateTransitions[from].includes(to);
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return orderTransitions[from].includes(to);
}

export function assertCandidateTransition(from: CandidateStatus, to: CandidateStatus): void {
  if (!canTransitionCandidate(from, to)) {
    throw new Error(`Invalid candidate transition: ${from} -> ${to}`);
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Invalid order transition: ${from} -> ${to}`);
  }
}

export const canonicalCandidateHappyPath: readonly CandidateStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "PRE_SCREENED",
  "VET_PENDING",
  "VERIFIED",
  "MATCHABLE",
  "RESERVED",
  "SOLD_TO_RAM",
  "TRANSFERRED"
];

export const canonicalOrderHappyPath: readonly OrderStatus[] = [
  "DRAFT",
  "CANDIDATE_HELD",
  "CHECKOUT_PENDING",
  "BUYER_COMMITTED",
  "ACQUISITION_COMMITTED",
  "CLEARANCE_PENDING",
  "READY_FOR_PICKUP",
  "IN_TRANSIT",
  "DELIVERED",
  "ACCEPTED",
  "SETTLED",
  "CLOSED"
];
