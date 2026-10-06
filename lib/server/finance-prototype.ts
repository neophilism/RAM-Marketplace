import type { FinancialMovementType } from "@/lib/finance-policy";

export type PrototypeSettlementStatus = "OPEN" | "SETTLED" | "CLOSED";
export type PrototypeLedgerEntryType =
  | "BUYER_RECEIVABLE"
  | "SUPPLIER_PAYABLE"
  | "DIRECT_COST"
  | FinancialMovementType;

export interface PrototypeFinancialLedgerEntry {
  id: string;
  type: PrototypeLedgerEntryType;
  amountCents: number;
  externalReference?: string;
  notes?: string;
  recordedByUserId: string;
  occurredAt: string;
}

export interface PrototypeFinancialSettlement {
  id: string;
  orderId: string;
  status: PrototypeSettlementStatus;
  buyerReceivableCents: number;
  supplierPayableCents: number;
  supplierScheduleCents: number;
  supplierMarketCeilingCents: number;
  directCostsCents: number;
  grossSpreadCents: number;
  openedAt: string;
  settledAt?: string;
  closedAt?: string;
  closedByUserId?: string;
  reconciliationReference?: string;
  reconciliationNotes?: string;
  entries: PrototypeFinancialLedgerEntry[];
}

declare global {
  // eslint-disable-next-line no-var
  var __ramPrototypeFinancialSettlements:
    | PrototypeFinancialSettlement[]
    | undefined;
}

function records() {
  if (!globalThis.__ramPrototypeFinancialSettlements) {
    globalThis.__ramPrototypeFinancialSettlements = [];
  }
  return globalThis.__ramPrototypeFinancialSettlements;
}

function ledgerId(settlement: PrototypeFinancialSettlement) {
  return `FL-${String(settlement.entries.length + 1).padStart(6, "0")}`;
}

export function listPrototypeFinancialSettlements() {
  return [...records()];
}

export function getPrototypeFinancialSettlement(id: string) {
  return records().find((settlement) => settlement.id === id);
}

export function getPrototypeFinancialSettlementForOrder(orderId: string) {
  return records().find((settlement) => settlement.orderId === orderId);
}

export function createPrototypeFinancialSettlement(input: {
  orderId: string;
  buyerReceivableCents: number;
  supplierPayableCents: number;
  supplierScheduleCents: number;
  supplierMarketCeilingCents: number;
  directCostsCents: number;
  grossSpreadCents: number;
  actorUserId: string;
}) {
  if (getPrototypeFinancialSettlementForOrder(input.orderId)) {
    throw new Error("Financial settlement already exists for this order");
  }

  const openedAt = new Date().toISOString();
  const settlement: PrototypeFinancialSettlement = {
    id: `FS-${String(records().length + 1).padStart(6, "0")}`,
    orderId: input.orderId,
    status: "OPEN",
    buyerReceivableCents: input.buyerReceivableCents,
    supplierPayableCents: input.supplierPayableCents,
    supplierScheduleCents: input.supplierScheduleCents,
    supplierMarketCeilingCents: input.supplierMarketCeilingCents,
    directCostsCents: input.directCostsCents,
    grossSpreadCents: input.grossSpreadCents,
    openedAt,
    entries: []
  };

  settlement.entries.push({
    id: ledgerId(settlement),
    type: "BUYER_RECEIVABLE",
    amountCents: input.buyerReceivableCents,
    recordedByUserId: input.actorUserId,
    occurredAt: openedAt
  });
  settlement.entries.push({
    id: ledgerId(settlement),
    type: "SUPPLIER_PAYABLE",
    amountCents: input.supplierPayableCents,
    recordedByUserId: input.actorUserId,
    occurredAt: openedAt
  });
  if (input.directCostsCents > 0) {
    settlement.entries.push({
      id: ledgerId(settlement),
      type: "DIRECT_COST",
      amountCents: input.directCostsCents,
      recordedByUserId: input.actorUserId,
      occurredAt: openedAt
    });
  }

  records().unshift(settlement);
  return settlement;
}

export function addPrototypeFinancialMovement(
  settlementId: string,
  input: {
    type: FinancialMovementType;
    amountCents: number;
    externalReference: string;
    notes?: string;
    recordedByUserId: string;
  }
) {
  const settlement = getPrototypeFinancialSettlement(settlementId);
  if (!settlement) throw new Error("Financial settlement not found");

  const entry: PrototypeFinancialLedgerEntry = {
    id: ledgerId(settlement),
    type: input.type,
    amountCents: input.amountCents,
    externalReference: input.externalReference,
    notes: input.notes,
    recordedByUserId: input.recordedByUserId,
    occurredAt: new Date().toISOString()
  };
  settlement.entries.push(entry);
  return entry;
}

export function updatePrototypeFinancialSettlement(
  id: string,
  updates: Partial<PrototypeFinancialSettlement>
) {
  const settlement = getPrototypeFinancialSettlement(id);
  if (!settlement) throw new Error("Financial settlement not found");
  Object.assign(settlement, updates);
  return settlement;
}
