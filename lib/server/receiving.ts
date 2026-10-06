import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import { assertBuyerOrderProjection } from "@/lib/commercial-privacy";
import { assertOrderTransition } from "@/lib/state-machines";
import { nextOrderStatusForReceiptDecision } from "@/lib/receiving-policy";
import { requireResearchNeedTransition } from "@/lib/workflows";
import type { ReceivingInspectionInput } from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeAnimal,
  getPrototypeOrder,
  getPrototypeOrders,
  getPrototypeResearchNeed,
  updatePrototypeOrder,
  updatePrototypeResearchNeed
} from "@/lib/server/prototype-store";
import { getPrototypeTransportAssignmentForOrder } from "@/lib/server/logistics-prototype";
import {
  getPrototypeReceiptInspection,
  savePrototypeReceiptInspection
} from "@/lib/server/receiving-prototype";

export interface ReceivingOrderSummary {
  id: string;
  animalCaseId: string;
  species: string;
  condition: string;
  researchNeedTitle: string;
  status: string;
  receivingFacilityName: string | null;
  receiptDecision: string | null;
  inspectedAt: string | null;
}

export interface ReceivingOrderDetail extends ReceivingOrderSummary {
  diseaseStage: string | null;
  diagnosticConfidence: string | null;
  publicSummary: string;
  protocolReference: string | null;
  deliveryConfirmedAt: string | null;
  deliveryNotes: string | null;
  inspection: {
    decision: string;
    animalIdentityConfirmed: boolean;
    movementDocumentsReceived: boolean;
    physicalConditionConsistent: boolean;
    welfareIntakeAcceptable: boolean;
    discrepancyNotes: string | null;
    notes: string | null;
    inspectedAt: string;
  } | null;
}

function assertBuyerOrganization(
  principal: SessionPrincipal,
  buyerOrganizationId: string
) {
  if (buyerOrganizationId !== principal.organizationId) {
    throw new Error("Order not found");
  }
}

export async function listReceivingOrders(
  principal: SessionPrincipal
): Promise<ReceivingOrderSummary[]> {
  requireCapability(principal.role, "order:receive");

  if (dataBackend() === "prototype") {
    return getPrototypeOrders()
      .filter(
        (order) =>
          order.buyerOrganizationId === principal.organizationId &&
          ["DELIVERED", "ACCEPTED", "REJECTED_AT_RECEIPT"].includes(order.status)
      )
      .map((order) => {
        const animal = getPrototypeAnimal(order.animalCaseId);
        const need = getPrototypeResearchNeed(order.researchNeedId);
        const inspection = getPrototypeReceiptInspection(order.id);
        const projected = {
          id: order.id,
          animalCaseId: order.animalCaseId,
          species: animal?.species ?? "Unknown",
          condition: animal?.condition ?? "Unknown",
          researchNeedTitle: need?.title ?? "Research need",
          status: order.status,
          receivingFacilityName: order.receivingFacilityName ?? null,
          receiptDecision: inspection?.decision ?? null,
          inspectedAt: inspection?.inspectedAt ?? null
        };
        assertBuyerOrderProjection(projected as unknown as Record<string, unknown>);
        return projected;
      });
  }

  const prisma = requirePrisma();
  const rows = await prisma.order.findMany({
    where: {
      buyerOrganizationId: principal.organizationId,
      status: { in: ["DELIVERED", "ACCEPTED", "REJECTED_AT_RECEIPT"] }
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      receivingFacilityName: true,
      animalCase: {
        select: {
          species: true,
          condition: true
        }
      },
      researchNeed: {
        select: { title: true }
      },
      receivingInspection: {
        select: {
          decision: true,
          inspectedAt: true
        }
      }
    }
  });

  return rows.map((row) => {
    const projected = {
      id: row.id,
      animalCaseId: row.animalCaseId,
      species: row.animalCase.species,
      condition: row.animalCase.condition,
      researchNeedTitle: row.researchNeed.title,
      status: row.status,
      receivingFacilityName: row.receivingFacilityName,
      receiptDecision: row.receivingInspection?.decision ?? null,
      inspectedAt: row.receivingInspection?.inspectedAt.toISOString() ?? null
    };
    assertBuyerOrderProjection(projected as unknown as Record<string, unknown>);
    return projected;
  });
}

export async function getReceivingOrder(
  principal: SessionPrincipal,
  orderId: string
): Promise<ReceivingOrderDetail> {
  requireCapability(principal.role, "order:receive");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(orderId);
    if (!order) throw new Error("Order not found");
    assertBuyerOrganization(principal, order.buyerOrganizationId);

    const animal = getPrototypeAnimal(order.animalCaseId);
    const need = getPrototypeResearchNeed(order.researchNeedId);
    if (!animal || !need) throw new Error("Receiving record is incomplete");

    const transport = getPrototypeTransportAssignmentForOrder(order.id);
    const delivery = transport?.events
      .filter((event) => event.type === "DELIVERY_CONFIRMED")
      .at(-1);
    const inspection = getPrototypeReceiptInspection(order.id);

    const projected: ReceivingOrderDetail = {
      id: order.id,
      animalCaseId: order.animalCaseId,
      species: animal.species,
      condition: animal.condition,
      researchNeedTitle: need.title,
      status: order.status,
      receivingFacilityName: order.receivingFacilityName ?? null,
      receiptDecision: inspection?.decision ?? null,
      inspectedAt: inspection?.inspectedAt ?? null,
      diseaseStage: animal.diseaseStage ?? null,
      diagnosticConfidence: animal.diagnosticConfidence ?? null,
      publicSummary: animal.publicSummary,
      protocolReference: order.protocolReference ?? null,
      deliveryConfirmedAt: delivery?.occurredAt ?? null,
      deliveryNotes: delivery?.notes ?? null,
      inspection: inspection
        ? {
            decision: inspection.decision,
            animalIdentityConfirmed: inspection.animalIdentityConfirmed,
            movementDocumentsReceived: inspection.movementDocumentsReceived,
            physicalConditionConsistent: inspection.physicalConditionConsistent,
            welfareIntakeAcceptable: inspection.welfareIntakeAcceptable,
            discrepancyNotes: inspection.discrepancyNotes ?? null,
            notes: inspection.notes ?? null,
            inspectedAt: inspection.inspectedAt
          }
        : null
    };
    assertBuyerOrderProjection(projected as unknown as Record<string, unknown>);
    return projected;
  }

  const prisma = requirePrisma();
  const row = await prisma.order.findFirst({
    where: {
      id: orderId,
      buyerOrganizationId: principal.organizationId
    },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      receivingFacilityName: true,
      protocolReference: true,
      animalCase: {
        select: {
          species: true,
          condition: true,
          diseaseStage: true,
          diagnosticConfidence: true,
          publicSummary: true
        }
      },
      researchNeed: {
        select: { title: true }
      },
      transportAssignment: {
        select: {
          events: {
            where: { type: "DELIVERY_CONFIRMED" },
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: {
              occurredAt: true,
              notes: true
            }
          }
        }
      },
      receivingInspection: {
        select: {
          decision: true,
          animalIdentityConfirmed: true,
          movementDocumentsReceived: true,
          physicalConditionConsistent: true,
          welfareIntakeAcceptable: true,
          discrepancyNotes: true,
          notes: true,
          inspectedAt: true
        }
      }
    }
  });
  if (!row) throw new Error("Order not found");

  const delivery = row.transportAssignment?.events[0];
  const inspection = row.receivingInspection;
  const projected: ReceivingOrderDetail = {
    id: row.id,
    animalCaseId: row.animalCaseId,
    species: row.animalCase.species,
    condition: row.animalCase.condition,
    researchNeedTitle: row.researchNeed.title,
    status: row.status,
    receivingFacilityName: row.receivingFacilityName,
    receiptDecision: inspection?.decision ?? null,
    inspectedAt: inspection?.inspectedAt.toISOString() ?? null,
    diseaseStage: row.animalCase.diseaseStage,
    diagnosticConfidence: row.animalCase.diagnosticConfidence,
    publicSummary: row.animalCase.publicSummary,
    protocolReference: row.protocolReference,
    deliveryConfirmedAt: delivery?.occurredAt.toISOString() ?? null,
    deliveryNotes: delivery?.notes ?? null,
    inspection: inspection
      ? {
          decision: inspection.decision,
          animalIdentityConfirmed: inspection.animalIdentityConfirmed,
          movementDocumentsReceived: inspection.movementDocumentsReceived,
          physicalConditionConsistent: inspection.physicalConditionConsistent,
          welfareIntakeAcceptable: inspection.welfareIntakeAcceptable,
          discrepancyNotes: inspection.discrepancyNotes,
          notes: inspection.notes,
          inspectedAt: inspection.inspectedAt.toISOString()
        }
      : null
  };

  assertBuyerOrderProjection(projected as unknown as Record<string, unknown>);
  return projected;
}

export async function recordReceivingInspection(
  principal: SessionPrincipal,
  input: ReceivingInspectionInput
) {
  requireCapability(principal.role, "order:receive");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(input.orderId);
    if (!order) throw new Error("Order not found");
    assertBuyerOrganization(principal, order.buyerOrganizationId);
    if (getPrototypeReceiptInspection(order.id)) {
      throw new Error("Receiving inspection has already been recorded");
    }

    const nextStatus = nextOrderStatusForReceiptDecision(
      order.status as never,
      input.decision
    );
    assertOrderTransition(order.status as never, nextStatus);

    const need = getPrototypeResearchNeed(order.researchNeedId);
    if (input.decision === "ACCEPT") {
      if (!need || need.status !== "ORDERED") {
        throw new Error("Research need is not ready to enter the study");
      }
      requireResearchNeedTransition("ORDERED", "IN_STUDY");
    }

    const inspection = savePrototypeReceiptInspection({
      orderId: order.id,
      inspectorUserId: principal.userId,
      decision: input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
      animalIdentityConfirmed: input.animalIdentityConfirmed,
      movementDocumentsReceived: input.movementDocumentsReceived,
      physicalConditionConsistent: input.physicalConditionConsistent,
      welfareIntakeAcceptable: input.welfareIntakeAcceptable,
      discrepancyNotes: input.discrepancyNotes,
      notes: input.notes
    });

    updatePrototypeOrder(order.id, { status: nextStatus });
    if (input.decision === "ACCEPT" && need) {
      updatePrototypeResearchNeed(need.id, { status: "IN_STUDY" });
    }

    return { orderId: order.id, status: nextStatus, inspection };
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        buyerOrganizationId: principal.organizationId
      },
      include: {
        researchNeed: { select: { status: true } },
        receivingInspection: { select: { id: true } }
      }
    });
    if (!order) throw new Error("Order not found");
    if (order.receivingInspection) {
      throw new Error("Receiving inspection has already been recorded");
    }

    const nextStatus = nextOrderStatusForReceiptDecision(
      order.status,
      input.decision
    );
    assertOrderTransition(order.status, nextStatus);

    if (input.decision === "ACCEPT") {
      if (order.researchNeed.status !== "ORDERED") {
        throw new Error("Research need is not ready to enter the study");
      }
      requireResearchNeedTransition("ORDERED", "IN_STUDY");
    }

    const inspection = await tx.receiptInspection.create({
      data: {
        orderId: order.id,
        inspectorUserId: principal.userId,
        decision: input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
        animalIdentityConfirmed: input.animalIdentityConfirmed,
        movementDocumentsReceived: input.movementDocumentsReceived,
        physicalConditionConsistent: input.physicalConditionConsistent,
        welfareIntakeAcceptable: input.welfareIntakeAcceptable,
        discrepancyNotes: input.discrepancyNotes ?? null,
        notes: input.notes ?? null
      }
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: nextStatus }
    });

    if (input.decision === "ACCEPT") {
      await tx.researchNeed.update({
        where: { id: order.researchNeedId },
        data: { status: "IN_STUDY" }
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action:
          input.decision === "ACCEPT"
            ? "ORDER_RECEIPT_ACCEPTED"
            : "ORDER_RECEIPT_REJECTED",
        entityType: "Order",
        entityId: order.id,
        previousState: { status: order.status },
        nextState: {
          status: nextStatus,
          receiptDecision: inspection.decision
        },
        reason: input.discrepancyNotes ?? null,
        metadata: {
          animalIdentityConfirmed: input.animalIdentityConfirmed,
          movementDocumentsReceived: input.movementDocumentsReceived,
          physicalConditionConsistent: input.physicalConditionConsistent,
          welfareIntakeAcceptable: input.welfareIntakeAcceptable,
          inspectorAttestation: input.inspectorAttestation
        }
      }
    });

    return { orderId: order.id, status: nextStatus, inspection };
  });
}
