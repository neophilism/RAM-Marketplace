import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import {
  assertMovementWithinOutstanding,
  assertReconciliationCloseReady,
  assertSettlementReady,
  financialBalances,
  type FinancialMovementType
} from "@/lib/finance-policy";
import { assertOrderTransition } from "@/lib/state-machines";
import type {
  FinancialMovementInput,
  SettlementCloseInput
} from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  addPrototypeFinancialMovement,
  getPrototypeFinancialSettlement,
  listPrototypeFinancialSettlements,
  updatePrototypeFinancialSettlement
} from "@/lib/server/finance-prototype";
import {
  getPrototypeAnimal,
  getPrototypeOrder,
  updatePrototypeOrder
} from "@/lib/server/prototype-store";

export interface FinancialSettlementSummary {
  id: string;
  orderId: string;
  animalCaseId: string;
  species: string;
  condition: string;
  orderStatus: string;
  settlementStatus: string;
  buyerReceivableCents: number;
  buyerPaidCents: number;
  buyerCreditsCents: number;
  buyerRefundedCents: number;
  buyerNetPaidCents: number;
  effectiveBuyerReceivableCents: number;
  buyerOutstandingCents: number;
  buyerRefundDueCents: number;
  supplierPayableCents: number;
  supplierPaidCents: number;
  supplierOutstandingCents: number;
  directCostsCents: number;
  grossSpreadCents: number;
  openedAt: string;
}

export interface FinancialSettlementDetail extends FinancialSettlementSummary {
  supplierScheduleCents: number;
  supplierMarketCeilingCents: number;
  settledAt: string | null;
  closedAt: string | null;
  reconciliationReference: string | null;
  reconciliationNotes: string | null;
  entries: Array<{
    id: string;
    type: string;
    amountCents: number;
    externalReference: string | null;
    notes: string | null;
    occurredAt: string;
  }>;
}

function movementEntries(
  entries: Array<{ type: string; amountCents: number }>
) {
  return entries
    .filter(
      (entry): entry is { type: FinancialMovementType; amountCents: number } =>
        entry.type === "BUYER_PAYMENT" ||
        entry.type === "SUPPLIER_PAYOUT" ||
        entry.type === "BUYER_CREDIT" ||
        entry.type === "BUYER_REFUND"
    )
    .map((entry) => ({ type: entry.type, amountCents: entry.amountCents }));
}

function prototypeSummary(settlement: ReturnType<typeof getPrototypeFinancialSettlement>) {
  if (!settlement) throw new Error("Financial settlement not found");
  const order = getPrototypeOrder(settlement.orderId);
  if (!order) throw new Error("Order not found");
  const animal = getPrototypeAnimal(order.animalCaseId);
  const balances = financialBalances(settlement, movementEntries(settlement.entries));

  return {
    id: settlement.id,
    orderId: settlement.orderId,
    animalCaseId: order.animalCaseId,
    species: animal?.species ?? "Unknown",
    condition: animal?.condition ?? "Unknown",
    orderStatus: order.status,
    settlementStatus: settlement.status,
    buyerReceivableCents: settlement.buyerReceivableCents,
    buyerPaidCents: balances.buyerPaidCents,
    buyerCreditsCents: balances.buyerCreditsCents,
    buyerRefundedCents: balances.buyerRefundedCents,
    buyerNetPaidCents: balances.buyerNetPaidCents,
    effectiveBuyerReceivableCents: balances.effectiveBuyerReceivableCents,
    buyerOutstandingCents: balances.buyerOutstandingCents,
    buyerRefundDueCents: balances.buyerRefundDueCents,
    supplierPayableCents: settlement.supplierPayableCents,
    supplierPaidCents: balances.supplierPaidCents,
    supplierOutstandingCents: balances.supplierOutstandingCents,
    directCostsCents: settlement.directCostsCents,
    grossSpreadCents: settlement.grossSpreadCents,
    openedAt: settlement.openedAt
  };
}

export async function listFinancialSettlements(
  principal: SessionPrincipal
): Promise<FinancialSettlementSummary[]> {
  requireCapability(principal.role, "settlement:manage");

  if (dataBackend() === "prototype") {
    return listPrototypeFinancialSettlements().map((settlement) =>
      prototypeSummary(settlement)
    );
  }

  const prisma = requirePrisma();
  const rows = await prisma.financialSettlement.findMany({
    orderBy: { openedAt: "desc" },
    include: {
      order: {
        select: {
          id: true,
          animalCaseId: true,
          status: true,
          animalCase: {
            select: { species: true, condition: true }
          }
        }
      },
      entries: {
        select: { type: true, amountCents: true }
      }
    }
  });

  return rows.map((row) => {
    const balances = financialBalances(row, movementEntries(row.entries));
    return {
      id: row.id,
      orderId: row.orderId,
      animalCaseId: row.order.animalCaseId,
      species: row.order.animalCase.species,
      condition: row.order.animalCase.condition,
      orderStatus: row.order.status,
      settlementStatus: row.status,
      buyerReceivableCents: row.buyerReceivableCents,
      buyerPaidCents: balances.buyerPaidCents,
      buyerCreditsCents: balances.buyerCreditsCents,
      buyerRefundedCents: balances.buyerRefundedCents,
      buyerNetPaidCents: balances.buyerNetPaidCents,
      effectiveBuyerReceivableCents: balances.effectiveBuyerReceivableCents,
      buyerOutstandingCents: balances.buyerOutstandingCents,
      buyerRefundDueCents: balances.buyerRefundDueCents,
      supplierPayableCents: row.supplierPayableCents,
      supplierPaidCents: balances.supplierPaidCents,
      supplierOutstandingCents: balances.supplierOutstandingCents,
      directCostsCents: row.directCostsCents,
      grossSpreadCents: row.grossSpreadCents,
      openedAt: row.openedAt.toISOString()
    };
  });
}

export async function getFinancialSettlement(
  principal: SessionPrincipal,
  settlementId: string
): Promise<FinancialSettlementDetail> {
  requireCapability(principal.role, "settlement:manage");

  if (dataBackend() === "prototype") {
    const settlement = getPrototypeFinancialSettlement(settlementId);
    if (!settlement) throw new Error("Financial settlement not found");
    const summary = prototypeSummary(settlement);
    return {
      ...summary,
      supplierScheduleCents: settlement.supplierScheduleCents,
      supplierMarketCeilingCents: settlement.supplierMarketCeilingCents,
      settledAt: settlement.settledAt ?? null,
      closedAt: settlement.closedAt ?? null,
      reconciliationReference: settlement.reconciliationReference ?? null,
      reconciliationNotes: settlement.reconciliationNotes ?? null,
      entries: settlement.entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amountCents: entry.amountCents,
        externalReference: entry.externalReference ?? null,
        notes: entry.notes ?? null,
        occurredAt: entry.occurredAt
      }))
    };
  }

  const prisma = requirePrisma();
  const row = await prisma.financialSettlement.findUnique({
    where: { id: settlementId },
    include: {
      order: {
        select: {
          animalCaseId: true,
          status: true,
          animalCase: {
            select: { species: true, condition: true }
          }
        }
      },
      entries: { orderBy: { occurredAt: "asc" } }
    }
  });
  if (!row) throw new Error("Financial settlement not found");

  const balances = financialBalances(row, movementEntries(row.entries));
  return {
    id: row.id,
    orderId: row.orderId,
    animalCaseId: row.order.animalCaseId,
    species: row.order.animalCase.species,
    condition: row.order.animalCase.condition,
    orderStatus: row.order.status,
    settlementStatus: row.status,
    buyerReceivableCents: row.buyerReceivableCents,
    buyerPaidCents: balances.buyerPaidCents,
    buyerCreditsCents: balances.buyerCreditsCents,
    buyerRefundedCents: balances.buyerRefundedCents,
    buyerNetPaidCents: balances.buyerNetPaidCents,
    effectiveBuyerReceivableCents: balances.effectiveBuyerReceivableCents,
    buyerOutstandingCents: balances.buyerOutstandingCents,
    buyerRefundDueCents: balances.buyerRefundDueCents,
    supplierPayableCents: row.supplierPayableCents,
    supplierPaidCents: balances.supplierPaidCents,
    supplierOutstandingCents: balances.supplierOutstandingCents,
    directCostsCents: row.directCostsCents,
    grossSpreadCents: row.grossSpreadCents,
    openedAt: row.openedAt.toISOString(),
    supplierScheduleCents: row.supplierScheduleCents,
    supplierMarketCeilingCents: row.supplierMarketCeilingCents,
    settledAt: row.settledAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    reconciliationReference: row.reconciliationReference,
    reconciliationNotes: row.reconciliationNotes,
    entries: row.entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      amountCents: entry.amountCents,
      externalReference: entry.externalReference,
      notes: entry.notes,
      occurredAt: entry.occurredAt.toISOString()
    }))
  };
}

export async function recordFinancialMovement(
  principal: SessionPrincipal,
  input: FinancialMovementInput
) {
  requireCapability(principal.role, "settlement:manage");
  const amountCents = Math.round(input.amountUsd * 100);

  if (dataBackend() === "prototype") {
    const settlement = getPrototypeFinancialSettlement(input.settlementId);
    if (!settlement) throw new Error("Financial settlement not found");
    if (settlement.status !== "OPEN") {
      throw new Error("Financial movements cannot be added after settlement");
    }
    const balances = financialBalances(settlement, movementEntries(settlement.entries));
    assertMovementWithinOutstanding(input.movementType, amountCents, balances);

    return addPrototypeFinancialMovement(settlement.id, {
      type: input.movementType,
      amountCents,
      externalReference: input.externalReference,
      notes: input.notes,
      recordedByUserId: principal.userId
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.financialSettlement.findUnique({
      where: { id: input.settlementId },
      include: {
        entries: { select: { type: true, amountCents: true } }
      }
    });
    if (!settlement) throw new Error("Financial settlement not found");
    if (settlement.status !== "OPEN") {
      throw new Error("Financial movements cannot be added after settlement");
    }

    const balances = financialBalances(
      settlement,
      movementEntries(settlement.entries)
    );
    assertMovementWithinOutstanding(input.movementType, amountCents, balances);

    const entry = await tx.financialLedgerEntry.create({
      data: {
        settlementId: settlement.id,
        type: input.movementType,
        amountCents,
        externalReference: input.externalReference,
        notes: input.notes ?? null,
        recordedByUserId: principal.userId
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action:
          input.movementType === "BUYER_PAYMENT"
            ? "BUYER_PAYMENT_RECORDED"
            : input.movementType === "SUPPLIER_PAYOUT"
              ? "SUPPLIER_PAYOUT_RECORDED"
              : input.movementType === "BUYER_CREDIT"
                ? "BUYER_CREDIT_RECORDED"
                : "BUYER_REFUND_RECORDED",
        entityType: "FinancialSettlement",
        entityId: settlement.id,
        nextState: {
          movementType: input.movementType,
          amountCents,
          externalReference: input.externalReference
        }
      }
    });

    return entry;
  });
}

export async function finalizeFinancialSettlement(
  principal: SessionPrincipal,
  settlementId: string
) {
  requireCapability(principal.role, "settlement:manage");

  if (dataBackend() === "prototype") {
    const settlement = getPrototypeFinancialSettlement(settlementId);
    if (!settlement) throw new Error("Financial settlement not found");
    if (settlement.status !== "OPEN") {
      throw new Error("Financial settlement is not open");
    }
    const order = getPrototypeOrder(settlement.orderId);
    if (!order) throw new Error("Order not found");
    const balances = financialBalances(settlement, movementEntries(settlement.entries));
    assertSettlementReady(order.status as never, balances);
    assertOrderTransition("ACCEPTED", "SETTLED");
    updatePrototypeOrder(order.id, { status: "SETTLED" });
    return updatePrototypeFinancialSettlement(settlement.id, {
      status: "SETTLED",
      settledAt: new Date().toISOString()
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.financialSettlement.findUnique({
      where: { id: settlementId },
      include: {
        order: { select: { id: true, status: true } },
        entries: { select: { type: true, amountCents: true } }
      }
    });
    if (!settlement) throw new Error("Financial settlement not found");
    if (settlement.status !== "OPEN") {
      throw new Error("Financial settlement is not open");
    }

    const balances = financialBalances(
      settlement,
      movementEntries(settlement.entries)
    );
    assertSettlementReady(settlement.order.status, balances);
    assertOrderTransition(settlement.order.status, "SETTLED");

    const now = new Date();
    await tx.order.update({
      where: { id: settlement.order.id },
      data: { status: "SETTLED" }
    });
    const updated = await tx.financialSettlement.update({
      where: { id: settlement.id },
      data: { status: "SETTLED", settledAt: now }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "FINANCIAL_SETTLEMENT_FINALIZED",
        entityType: "Order",
        entityId: settlement.order.id,
        previousState: { status: settlement.order.status },
        nextState: { status: "SETTLED", settlementId: settlement.id },
        metadata: balances
      }
    });

    return updated;
  });
}

export async function closeFinancialSettlement(
  principal: SessionPrincipal,
  input: SettlementCloseInput
) {
  requireCapability(principal.role, "settlement:manage");

  if (dataBackend() === "prototype") {
    const settlement = getPrototypeFinancialSettlement(input.settlementId);
    if (!settlement) throw new Error("Financial settlement not found");
    const order = getPrototypeOrder(settlement.orderId);
    if (!order) throw new Error("Order not found");
    assertReconciliationCloseReady(order.status as never, settlement.status);
    assertOrderTransition("SETTLED", "CLOSED");
    updatePrototypeOrder(order.id, { status: "CLOSED" });
    return updatePrototypeFinancialSettlement(settlement.id, {
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      closedByUserId: principal.userId,
      reconciliationReference: input.reconciliationReference,
      reconciliationNotes: input.reconciliationNotes
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.financialSettlement.findUnique({
      where: { id: input.settlementId },
      include: { order: { select: { id: true, status: true } } }
    });
    if (!settlement) throw new Error("Financial settlement not found");

    assertReconciliationCloseReady(settlement.order.status, settlement.status);
    assertOrderTransition(settlement.order.status, "CLOSED");

    const now = new Date();
    await tx.order.update({
      where: { id: settlement.order.id },
      data: { status: "CLOSED" }
    });
    const updated = await tx.financialSettlement.update({
      where: { id: settlement.id },
      data: {
        status: "CLOSED",
        closedAt: now,
        closedByUserId: principal.userId,
        reconciliationReference: input.reconciliationReference,
        reconciliationNotes: input.reconciliationNotes ?? null
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "FINANCIAL_SETTLEMENT_RECONCILED_AND_CLOSED",
        entityType: "Order",
        entityId: settlement.order.id,
        previousState: { status: settlement.order.status },
        nextState: { status: "CLOSED", settlementId: settlement.id },
        metadata: {
          reconciliationReference: input.reconciliationReference,
          reconciliationAttestation: input.reconciliationAttestation
        }
      }
    });

    return updated;
  });
}
