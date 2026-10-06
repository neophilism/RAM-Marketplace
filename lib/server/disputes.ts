import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import {
  disputeResolutionTarget,
  type DisputeResolutionType
} from "@/lib/dispute-policy";
import {
  assertDisputeFinancialResolutionReady,
  financialBalances,
  type FinancialMovementType
} from "@/lib/finance-policy";
import { assertOrderTransition } from "@/lib/state-machines";
import { requireResearchNeedTransition } from "@/lib/workflows";
import type { DisputeResolutionInput } from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeOrderDispute,
  listPrototypeOrderDisputes,
  resolvePrototypeOrderDispute
} from "@/lib/server/disputes-prototype";
import {
  getPrototypeFinancialSettlementForOrder,
  updatePrototypeFinancialSettlement
} from "@/lib/server/finance-prototype";
import {
  getPrototypeAnimal,
  getPrototypeOrder,
  getPrototypeResearchNeed,
  updatePrototypeOrder,
  updatePrototypeResearchNeed
} from "@/lib/server/prototype-store";
import { getPrototypeReceiptInspection } from "@/lib/server/receiving-prototype";

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

export interface DisputeSummary {
  id: string;
  orderId: string;
  animalCaseId: string;
  species: string;
  condition: string;
  status: string;
  orderStatus: string;
  reason: string;
  openedAt: string;
  resolutionType: string | null;
}

export interface DisputeDetail extends DisputeSummary {
  researchNeedId: string;
  researchNeedTitle: string;
  researchNeedStatus: string;
  receiptDecision: string | null;
  receiptDiscrepancyNotes: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  financialSettlementId: string | null;
  buyerReceivableCents: number;
  buyerCreditsCents: number;
  buyerPaidCents: number;
  buyerRefundedCents: number;
  buyerOutstandingCents: number;
  buyerRefundDueCents: number;
  supplierPayableCents: number;
  supplierPaidCents: number;
  supplierOutstandingCents: number;
}

function prototypeDetail(disputeId: string): DisputeDetail {
  const dispute = getPrototypeOrderDispute(disputeId);
  if (!dispute) throw new Error("Order dispute not found");

  const order = getPrototypeOrder(dispute.orderId);
  if (!order) throw new Error("Order not found");
  const animal = getPrototypeAnimal(order.animalCaseId);
  const need = getPrototypeResearchNeed(order.researchNeedId);
  if (!need) throw new Error("Research need not found");
  const receipt = getPrototypeReceiptInspection(order.id);
  const settlement = getPrototypeFinancialSettlementForOrder(order.id);
  const balances = settlement
    ? financialBalances(settlement, movementEntries(settlement.entries))
    : {
        buyerPaidCents: 0,
        buyerCreditsCents: 0,
        buyerRefundedCents: 0,
        buyerOutstandingCents: 0,
        buyerRefundDueCents: 0,
        supplierPaidCents: 0,
        supplierOutstandingCents: 0
      };

  return {
    id: dispute.id,
    orderId: order.id,
    animalCaseId: order.animalCaseId,
    species: animal?.species ?? "Unknown",
    condition: animal?.condition ?? "Unknown",
    status: dispute.status,
    orderStatus: order.status,
    reason: dispute.reason,
    openedAt: dispute.openedAt,
    resolutionType: dispute.resolutionType ?? null,
    researchNeedId: need.id,
    researchNeedTitle: need.title,
    researchNeedStatus: need.status,
    receiptDecision: receipt?.decision ?? null,
    receiptDiscrepancyNotes: receipt?.discrepancyNotes ?? null,
    resolutionNotes: dispute.resolutionNotes ?? null,
    resolvedAt: dispute.resolvedAt ?? null,
    financialSettlementId: settlement?.id ?? null,
    buyerReceivableCents: settlement?.buyerReceivableCents ?? 0,
    buyerCreditsCents: balances.buyerCreditsCents,
    buyerPaidCents: balances.buyerPaidCents,
    buyerRefundedCents: balances.buyerRefundedCents,
    buyerOutstandingCents: balances.buyerOutstandingCents,
    buyerRefundDueCents: balances.buyerRefundDueCents,
    supplierPayableCents: settlement?.supplierPayableCents ?? 0,
    supplierPaidCents: balances.supplierPaidCents,
    supplierOutstandingCents: balances.supplierOutstandingCents
  };
}

export async function listOrderDisputes(
  principal: SessionPrincipal
): Promise<DisputeSummary[]> {
  requireCapability(principal.role, "dispute:manage");

  if (dataBackend() === "prototype") {
    return listPrototypeOrderDisputes().map((dispute) => {
      const order = getPrototypeOrder(dispute.orderId);
      const animal = order ? getPrototypeAnimal(order.animalCaseId) : undefined;
      return {
        id: dispute.id,
        orderId: dispute.orderId,
        animalCaseId: order?.animalCaseId ?? "Unknown",
        species: animal?.species ?? "Unknown",
        condition: animal?.condition ?? "Unknown",
        status: dispute.status,
        orderStatus: order?.status ?? "UNKNOWN",
        reason: dispute.reason,
        openedAt: dispute.openedAt,
        resolutionType: dispute.resolutionType ?? null
      };
    });
  }

  const prisma = requirePrisma();
  const rows = await prisma.orderDispute.findMany({
    orderBy: [{ status: "asc" }, { openedAt: "asc" }],
    select: {
      id: true,
      status: true,
      reason: true,
      openedAt: true,
      resolutionType: true,
      order: {
        select: {
          id: true,
          animalCaseId: true,
          status: true,
          animalCase: { select: { species: true, condition: true } }
        }
      }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    orderId: row.order.id,
    animalCaseId: row.order.animalCaseId,
    species: row.order.animalCase.species,
    condition: row.order.animalCase.condition,
    status: row.status,
    orderStatus: row.order.status,
    reason: row.reason,
    openedAt: row.openedAt.toISOString(),
    resolutionType: row.resolutionType
  }));
}

export async function getOrderDispute(
  principal: SessionPrincipal,
  disputeId: string
): Promise<DisputeDetail> {
  requireCapability(principal.role, "dispute:manage");

  if (dataBackend() === "prototype") {
    return prototypeDetail(disputeId);
  }

  const prisma = requirePrisma();
  const row = await prisma.orderDispute.findUnique({
    where: { id: disputeId },
    include: {
      order: {
        include: {
          animalCase: { select: { species: true, condition: true } },
          researchNeed: { select: { id: true, title: true, status: true } },
          receivingInspection: {
            select: {
              decision: true,
              discrepancyNotes: true
            }
          },
          financialSettlement: {
            include: {
              entries: {
                select: { type: true, amountCents: true }
              }
            }
          }
        }
      }
    }
  });
  if (!row) throw new Error("Order dispute not found");

  const settlement = row.order.financialSettlement;
  const balances = settlement
    ? financialBalances(settlement, movementEntries(settlement.entries))
    : {
        buyerPaidCents: 0,
        buyerCreditsCents: 0,
        buyerRefundedCents: 0,
        buyerOutstandingCents: 0,
        buyerRefundDueCents: 0,
        supplierPaidCents: 0,
        supplierOutstandingCents: 0
      };

  return {
    id: row.id,
    orderId: row.order.id,
    animalCaseId: row.order.animalCaseId,
    species: row.order.animalCase.species,
    condition: row.order.animalCase.condition,
    status: row.status,
    orderStatus: row.order.status,
    reason: row.reason,
    openedAt: row.openedAt.toISOString(),
    resolutionType: row.resolutionType,
    researchNeedId: row.order.researchNeed.id,
    researchNeedTitle: row.order.researchNeed.title,
    researchNeedStatus: row.order.researchNeed.status,
    receiptDecision: row.order.receivingInspection?.decision ?? null,
    receiptDiscrepancyNotes:
      row.order.receivingInspection?.discrepancyNotes ?? null,
    resolutionNotes: row.resolutionNotes,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    financialSettlementId: settlement?.id ?? null,
    buyerReceivableCents: settlement?.buyerReceivableCents ?? 0,
    buyerCreditsCents: balances.buyerCreditsCents,
    buyerPaidCents: balances.buyerPaidCents,
    buyerRefundedCents: balances.buyerRefundedCents,
    buyerOutstandingCents: balances.buyerOutstandingCents,
    buyerRefundDueCents: balances.buyerRefundDueCents,
    supplierPayableCents: settlement?.supplierPayableCents ?? 0,
    supplierPaidCents: balances.supplierPaidCents,
    supplierOutstandingCents: balances.supplierOutstandingCents
  };
}

export async function resolveOrderDispute(
  principal: SessionPrincipal,
  input: DisputeResolutionInput
) {
  requireCapability(principal.role, "dispute:manage");

  if (dataBackend() === "prototype") {
    const dispute = getPrototypeOrderDispute(input.disputeId);
    if (!dispute || dispute.status !== "OPEN") {
      throw new Error("Open order dispute not found");
    }
    const order = getPrototypeOrder(dispute.orderId);
    if (!order) throw new Error("Order not found");
    const need = getPrototypeResearchNeed(order.researchNeedId);
    if (!need) throw new Error("Research need not found");
    const settlement = getPrototypeFinancialSettlementForOrder(order.id);
    if (!settlement) throw new Error("Financial settlement not found");

    const balances = financialBalances(
      settlement,
      movementEntries(settlement.entries)
    );
    const target = disputeResolutionTarget(
      order.status as never,
      need.status as never,
      input.resolutionType,
      {
        buyerReceivableCents: settlement.buyerReceivableCents,
        buyerCreditsCents: balances.buyerCreditsCents,
        buyerOutstandingCents: balances.buyerOutstandingCents,
        buyerRefundDueCents: balances.buyerRefundDueCents,
        supplierOutstandingCents: balances.supplierOutstandingCents
      }
    );

    assertOrderTransition(order.status as never, target.orderStatus);
    requireResearchNeedTransition(
      need.status as never,
      target.researchNeedStatus
    );

    if (target.settleFinancials) {
      assertDisputeFinancialResolutionReady(order.status as never, balances);
      updatePrototypeFinancialSettlement(settlement.id, {
        status: "SETTLED",
        settledAt: new Date().toISOString()
      });
    }

    updatePrototypeOrder(order.id, { status: target.orderStatus });
    updatePrototypeResearchNeed(need.id, {
      status: target.researchNeedStatus
    });
    const resolved = resolvePrototypeOrderDispute(dispute.id, {
      resolutionType: input.resolutionType,
      resolutionNotes: input.resolutionNotes,
      resolvedByUserId: principal.userId
    });

    return { dispute: resolved, orderStatus: target.orderStatus };
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const dispute = await tx.orderDispute.findUnique({
      where: { id: input.disputeId },
      include: {
        order: {
          include: {
            researchNeed: { select: { status: true } },
            financialSettlement: {
              include: {
                entries: {
                  select: { type: true, amountCents: true }
                }
              }
            }
          }
        }
      }
    });
    if (!dispute || dispute.status !== "OPEN") {
      throw new Error("Open order dispute not found");
    }

    const settlement = dispute.order.financialSettlement;
    if (!settlement) throw new Error("Financial settlement not found");

    const balances = financialBalances(
      settlement,
      movementEntries(settlement.entries)
    );
    const target = disputeResolutionTarget(
      dispute.order.status,
      dispute.order.researchNeed.status,
      input.resolutionType,
      {
        buyerReceivableCents: settlement.buyerReceivableCents,
        buyerCreditsCents: balances.buyerCreditsCents,
        buyerOutstandingCents: balances.buyerOutstandingCents,
        buyerRefundDueCents: balances.buyerRefundDueCents,
        supplierOutstandingCents: balances.supplierOutstandingCents
      }
    );

    assertOrderTransition(dispute.order.status, target.orderStatus);
    requireResearchNeedTransition(
      dispute.order.researchNeed.status,
      target.researchNeedStatus
    );

    const now = new Date();
    if (target.settleFinancials) {
      if (settlement.status !== "OPEN") {
        throw new Error("Disputed order financial settlement is not open");
      }
      assertDisputeFinancialResolutionReady(dispute.order.status, balances);
      await tx.financialSettlement.update({
        where: { id: settlement.id },
        data: { status: "SETTLED", settledAt: now }
      });
    }

    await tx.order.update({
      where: { id: dispute.order.id },
      data: { status: target.orderStatus }
    });
    await tx.researchNeed.update({
      where: { id: dispute.order.researchNeedId },
      data: { status: target.researchNeedStatus }
    });

    const resolved = await tx.orderDispute.update({
      where: { id: dispute.id },
      data: {
        status: "RESOLVED",
        resolutionType: input.resolutionType,
        resolutionNotes: input.resolutionNotes,
        resolvedByUserId: principal.userId,
        resolvedAt: now
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "ORDER_DISPUTE_RESOLVED",
        entityType: "OrderDispute",
        entityId: dispute.id,
        previousState: {
          disputeStatus: dispute.status,
          orderStatus: dispute.order.status,
          researchNeedStatus: dispute.order.researchNeed.status
        },
        nextState: {
          disputeStatus: "RESOLVED",
          resolutionType: input.resolutionType,
          orderStatus: target.orderStatus,
          researchNeedStatus: target.researchNeedStatus,
          settlementStatus: target.settleFinancials
            ? "SETTLED"
            : settlement.status
        },
        reason: input.resolutionNotes,
        metadata: {
          operatorAttestation: input.operatorAttestation,
          financialBalances: balances
        }
      }
    });

    return { dispute: resolved, orderStatus: target.orderStatus };
  });
}
