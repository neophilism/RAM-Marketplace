import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import { assertCandidateTransition, assertOrderTransition } from "@/lib/state-machines";
import {
  assertTransportAssignmentEligible,
  nextOrderStatusForTransportEvent
} from "@/lib/logistics-policy";
import { assertTransportPacketProjection } from "@/lib/logistics-privacy";
import type {
  TransportAssignmentInput,
  TransportEventInput
} from "@/lib/validation";
import { dataBackend, requirePrisma } from "@/lib/server/db";
import {
  getPrototypeAnimal,
  getPrototypeOrder,
  getPrototypeOrders,
  updatePrototypeAnimal,
  updatePrototypeOrder
} from "@/lib/server/prototype-store";
import {
  addPrototypeTransportEvent,
  getPrototypeTransportAssignment,
  getPrototypeTransportAssignmentForOrder,
  listPrototypeTransportAssignments,
  savePrototypeTransportAssignment
} from "@/lib/server/logistics-prototype";

function lines(value: string | undefined) {
  return (value ?? "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateOrNull(value: string | undefined) {
  return value?.trim() ? new Date(value) : null;
}

function assertAssignedCarrier(
  principal: SessionPrincipal,
  assignment: { transportOrganizationId: string; assignedTransportUserId?: string | null }
) {
  if (assignment.transportOrganizationId !== principal.organizationId) {
    throw new Error("Forbidden: transport assignment belongs to another organization");
  }
  if (
    assignment.assignedTransportUserId &&
    assignment.assignedTransportUserId !== principal.userId
  ) {
    throw new Error("Forbidden: transport assignment is assigned to another user");
  }
}

export interface LogisticsOrganizationView {
  id: string;
  name: string;
}

export interface TransportReadyOrderView {
  id: string;
  animalCaseId: string;
  species: string;
  condition: string;
  status: string;
  assigned: boolean;
}

export interface TransportAssignmentSummary {
  id: string;
  orderId: string;
  animalCaseId: string;
  species: string;
  condition: string;
  orderStatus: string;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  assignedAt: string;
}

export interface TransportAssignmentDetail extends TransportAssignmentSummary {
  pickupAddress: string;
  pickupContactName: string;
  pickupContactEmail: string;
  deliveryFacilityName: string;
  deliveryAddress: string;
  movementDocumentRefs: string[];
  sanitationRequirements: string | null;
  specialInstructions: string | null;
  events: Array<{
    id: string;
    type: string;
    occurredAt: string;
    notes: string | null;
    sanitationConfirmed: boolean | null;
    custodyAttested: boolean;
  }>;
}

export async function listLogisticsOrganizations(
  principal: SessionPrincipal
): Promise<LogisticsOrganizationView[]> {
  requireCapability(principal.role, "transport:assign");

  if (dataBackend() === "prototype") {
    return [{ id: "demo-logistics-organization", name: "RAM Logistics Demo" }];
  }

  const prisma = requirePrisma();
  return prisma.organization.findMany({
    where: { type: "LOGISTICS", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
}

export async function listTransportReadyOrders(
  principal: SessionPrincipal
): Promise<TransportReadyOrderView[]> {
  requireCapability(principal.role, "transport:assign");

  if (dataBackend() === "prototype") {
    return getPrototypeOrders()
      .filter((order) => order.status === "READY_FOR_PICKUP")
      .map((order) => {
        const animal = getPrototypeAnimal(order.animalCaseId);
        return {
          id: order.id,
          animalCaseId: order.animalCaseId,
          species: animal?.species ?? "Unknown",
          condition: animal?.condition ?? "Unknown",
          status: order.status,
          assigned: Boolean(getPrototypeTransportAssignmentForOrder(order.id))
        };
      });
  }

  const prisma = requirePrisma();
  const rows = await prisma.order.findMany({
    where: { status: "READY_FOR_PICKUP" },
    orderBy: { clearedAt: "asc" },
    select: {
      id: true,
      animalCaseId: true,
      status: true,
      animalCase: { select: { species: true, condition: true } },
      transportAssignment: { select: { id: true } }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    animalCaseId: row.animalCaseId,
    species: row.animalCase.species,
    condition: row.animalCase.condition,
    status: row.status,
    assigned: Boolean(row.transportAssignment)
  }));
}

export async function assignTransport(
  principal: SessionPrincipal,
  input: TransportAssignmentInput
) {
  requireCapability(principal.role, "transport:assign");

  if (dataBackend() === "prototype") {
    const order = getPrototypeOrder(input.orderId);
    if (!order) throw new Error("Order not found");
    assertTransportAssignmentEligible(order.status as never);

    return savePrototypeTransportAssignment({
      orderId: order.id,
      transportOrganizationId: input.transportOrganizationId,
      assignedTransportUserId: input.assignedTransportUserId,
      assignedByUserId: principal.userId,
      pickupWindowStart: input.pickupWindowStart,
      pickupWindowEnd: input.pickupWindowEnd,
      deliveryWindowStart: input.deliveryWindowStart,
      deliveryWindowEnd: input.deliveryWindowEnd,
      movementDocumentRefs: lines(input.movementDocumentRefs),
      sanitationRequirements: input.sanitationRequirements,
      specialInstructions: input.specialInstructions
    });
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        status: true,
        transportAssignment: { select: { id: true } }
      }
    });
    if (!order) throw new Error("Order not found");
    assertTransportAssignmentEligible(order.status);
    if (order.transportAssignment) {
      throw new Error("Order already has a transport assignment");
    }

    const organization = await tx.organization.findUnique({
      where: { id: input.transportOrganizationId },
      select: { id: true, type: true, status: true }
    });
    if (
      !organization ||
      organization.type !== "LOGISTICS" ||
      organization.status !== "ACTIVE"
    ) {
      throw new Error("Transport organization must be an active logistics organization");
    }

    if (input.assignedTransportUserId) {
      const membership = await tx.membership.findFirst({
        where: {
          userId: input.assignedTransportUserId,
          organizationId: organization.id,
          role: "TRANSPORT_PROVIDER",
          status: "ACTIVE"
        },
        select: { id: true }
      });
      if (!membership) {
        throw new Error(
          "Assigned transport user must be an active transport provider in that organization"
        );
      }
    }

    const created = await tx.transportAssignment.create({
      data: {
        orderId: order.id,
        transportOrganizationId: organization.id,
        assignedTransportUserId: input.assignedTransportUserId ?? null,
        assignedByUserId: principal.userId,
        pickupWindowStart: dateOrNull(input.pickupWindowStart),
        pickupWindowEnd: dateOrNull(input.pickupWindowEnd),
        deliveryWindowStart: dateOrNull(input.deliveryWindowStart),
        deliveryWindowEnd: dateOrNull(input.deliveryWindowEnd),
        movementDocumentRefs: lines(input.movementDocumentRefs),
        sanitationRequirements: input.sanitationRequirements ?? null,
        specialInstructions: input.specialInstructions ?? null,
        events: {
          create: {
            actorUserId: principal.userId,
            type: "ASSIGNED",
            custodyAttested: false,
            previousOrderStatus: order.status,
            nextOrderStatus: order.status,
            notes: "Transport assignment created after clearance."
          }
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "TRANSPORT_ASSIGNED",
        entityType: "Order",
        entityId: order.id,
        previousState: { status: order.status },
        nextState: { status: order.status, transportAssignmentId: created.id },
        metadata: { transportOrganizationId: organization.id }
      }
    });

    return created;
  });
}

export async function listTransportAssignments(
  principal: SessionPrincipal
): Promise<TransportAssignmentSummary[]> {
  requireCapability(principal.role, "transport:update");

  if (dataBackend() === "prototype") {
    return listPrototypeTransportAssignments()
      .filter(
        (assignment) =>
          assignment.transportOrganizationId === principal.organizationId &&
          (!assignment.assignedTransportUserId ||
            assignment.assignedTransportUserId === principal.userId)
      )
      .map((assignment) => {
        const order = getPrototypeOrder(assignment.orderId);
        const animal = order ? getPrototypeAnimal(order.animalCaseId) : undefined;
        return {
          id: assignment.id,
          orderId: assignment.orderId,
          animalCaseId: order?.animalCaseId ?? "Unknown",
          species: animal?.species ?? "Unknown",
          condition: animal?.condition ?? "Unknown",
          orderStatus: order?.status ?? "UNKNOWN",
          pickupWindowStart: assignment.pickupWindowStart ?? null,
          pickupWindowEnd: assignment.pickupWindowEnd ?? null,
          deliveryWindowStart: assignment.deliveryWindowStart ?? null,
          deliveryWindowEnd: assignment.deliveryWindowEnd ?? null,
          assignedAt: assignment.assignedAt
        };
      });
  }

  const prisma = requirePrisma();
  const rows = await prisma.transportAssignment.findMany({
    where: {
      transportOrganizationId: principal.organizationId,
      OR: [
        { assignedTransportUserId: null },
        { assignedTransportUserId: principal.userId }
      ]
    },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      orderId: true,
      assignedAt: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      deliveryWindowStart: true,
      deliveryWindowEnd: true,
      order: {
        select: {
          animalCaseId: true,
          status: true,
          animalCase: { select: { species: true, condition: true } }
        }
      }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    animalCaseId: row.order.animalCaseId,
    species: row.order.animalCase.species,
    condition: row.order.animalCase.condition,
    orderStatus: row.order.status,
    pickupWindowStart: row.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: row.pickupWindowEnd?.toISOString() ?? null,
    deliveryWindowStart: row.deliveryWindowStart?.toISOString() ?? null,
    deliveryWindowEnd: row.deliveryWindowEnd?.toISOString() ?? null,
    assignedAt: row.assignedAt.toISOString()
  }));
}

export async function getTransportAssignment(
  principal: SessionPrincipal,
  assignmentId: string
): Promise<TransportAssignmentDetail> {
  requireCapability(principal.role, "transport:update");

  if (dataBackend() === "prototype") {
    const assignment = getPrototypeTransportAssignment(assignmentId);
    if (!assignment) throw new Error("Transport assignment not found");
    assertAssignedCarrier(principal, assignment);

    const order = getPrototypeOrder(assignment.orderId);
    const animal = order ? getPrototypeAnimal(order.animalCaseId) : undefined;
    if (!order || !animal) throw new Error("Transport order is unavailable");

    const packet: TransportAssignmentDetail = {
      id: assignment.id,
      orderId: order.id,
      animalCaseId: order.animalCaseId,
      species: animal.species,
      condition: animal.condition,
      orderStatus: order.status,
      pickupWindowStart: assignment.pickupWindowStart ?? null,
      pickupWindowEnd: assignment.pickupWindowEnd ?? null,
      deliveryWindowStart: assignment.deliveryWindowStart ?? null,
      deliveryWindowEnd: assignment.deliveryWindowEnd ?? null,
      assignedAt: assignment.assignedAt,
      pickupAddress: "Prototype restricted pickup address",
      pickupContactName: "Prototype farm pickup contact",
      pickupContactEmail: "pickup@prototype.invalid",
      deliveryFacilityName: order.receivingFacilityName ?? "Receiving facility",
      deliveryAddress:
        order.receivingFacilityAddress ?? "Receiving address unavailable",
      movementDocumentRefs: assignment.movementDocumentRefs,
      sanitationRequirements: assignment.sanitationRequirements ?? null,
      specialInstructions: assignment.specialInstructions ?? null,
      events: assignment.events.map((event) => ({
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt,
        notes: event.notes ?? null,
        sanitationConfirmed: event.sanitationConfirmed ?? null,
        custodyAttested: event.custodyAttested
      }))
    };

    assertTransportPacketProjection(packet as unknown as Record<string, unknown>);
    return packet;
  }

  const prisma = requirePrisma();
  const assignment = await prisma.transportAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      order: {
        include: {
          animalCase: { include: { sourceRecord: true } }
        }
      },
      events: { orderBy: { occurredAt: "asc" } }
    }
  });
  if (!assignment) throw new Error("Transport assignment not found");
  assertAssignedCarrier(principal, assignment);

  const source = assignment.order.animalCase.sourceRecord;
  if (!source) throw new Error("Restricted pickup record is unavailable");
  if (
    !assignment.order.receivingFacilityAddress ||
    !assignment.order.receivingFacilityName
  ) {
    throw new Error("Receiving facility details are unavailable");
  }

  const movementDocumentRefs = Array.isArray(assignment.movementDocumentRefs)
    ? assignment.movementDocumentRefs.filter(
        (value): value is string => typeof value === "string"
      )
    : [];

  const packet: TransportAssignmentDetail = {
    id: assignment.id,
    orderId: assignment.orderId,
    animalCaseId: assignment.order.animalCaseId,
    species: assignment.order.animalCase.species,
    condition: assignment.order.animalCase.condition,
    orderStatus: assignment.order.status,
    pickupWindowStart: assignment.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: assignment.pickupWindowEnd?.toISOString() ?? null,
    deliveryWindowStart: assignment.deliveryWindowStart?.toISOString() ?? null,
    deliveryWindowEnd: assignment.deliveryWindowEnd?.toISOString() ?? null,
    assignedAt: assignment.assignedAt.toISOString(),
    pickupAddress: source.exactAddress,
    pickupContactName: source.ownerContactName,
    pickupContactEmail: source.ownerContactEmail,
    deliveryFacilityName: assignment.order.receivingFacilityName,
    deliveryAddress: assignment.order.receivingFacilityAddress,
    movementDocumentRefs,
    sanitationRequirements: assignment.sanitationRequirements,
    specialInstructions: assignment.specialInstructions,
    events: assignment.events.map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
      notes: event.notes,
      sanitationConfirmed: event.sanitationConfirmed,
      custodyAttested: event.custodyAttested
    }))
  };

  assertTransportPacketProjection(packet as unknown as Record<string, unknown>);
  return packet;
}

export async function recordTransportEvent(
  principal: SessionPrincipal,
  input: TransportEventInput
) {
  requireCapability(principal.role, "transport:update");

  if (dataBackend() === "prototype") {
    const assignment = getPrototypeTransportAssignment(input.assignmentId);
    if (!assignment) throw new Error("Transport assignment not found");
    assertAssignedCarrier(principal, assignment);

    const order = getPrototypeOrder(assignment.orderId);
    if (!order) throw new Error("Order not found");

    const previous = order.status as never;
    const next = nextOrderStatusForTransportEvent(previous, input.eventType);
    assertOrderTransition(previous, next);
    updatePrototypeOrder(order.id, { status: next });

    if (next === "DELIVERED") {
      const animal = getPrototypeAnimal(order.animalCaseId);
      if (animal?.status === "SOLD_TO_RAM") {
        assertCandidateTransition("SOLD_TO_RAM", "TRANSFERRED");
        updatePrototypeAnimal(order.animalCaseId, { status: "TRANSFERRED" });
      }
    }

    addPrototypeTransportEvent(assignment.id, {
      type: input.eventType,
      actorUserId: principal.userId,
      notes: input.notes,
      sanitationConfirmed: input.sanitationConfirmed,
      custodyAttested: input.custodyAttestation === true,
      previousOrderStatus: previous,
      nextOrderStatus: next
    });

    return { assignmentId: assignment.id, orderStatus: next };
  }

  const prisma = requirePrisma();
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.transportAssignment.findUnique({
      where: { id: input.assignmentId },
      include: {
        order: { select: { id: true, status: true, animalCaseId: true } }
      }
    });
    if (!assignment) throw new Error("Transport assignment not found");
    assertAssignedCarrier(principal, assignment);

    const previous = assignment.order.status;
    const next = nextOrderStatusForTransportEvent(previous, input.eventType);
    assertOrderTransition(previous, next);

    await tx.order.update({
      where: { id: assignment.order.id },
      data: { status: next }
    });

    if (next === "DELIVERED") {
      const animal = await tx.animalCase.findUnique({
        where: { publicId: assignment.order.animalCaseId },
        select: { status: true }
      });
      if (animal?.status === "SOLD_TO_RAM") {
        assertCandidateTransition("SOLD_TO_RAM", "TRANSFERRED");
        await tx.animalCase.update({
          where: { publicId: assignment.order.animalCaseId },
          data: { status: "TRANSFERRED" }
        });
      }
    }

    await tx.transportEvent.create({
      data: {
        assignmentId: assignment.id,
        actorUserId: principal.userId,
        type: input.eventType,
        notes: input.notes ?? null,
        sanitationConfirmed: input.sanitationConfirmed ?? null,
        custodyAttested: input.custodyAttestation === true,
        previousOrderStatus: previous,
        nextOrderStatus: next
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "TRANSPORT_" + input.eventType,
        entityType: "Order",
        entityId: assignment.order.id,
        previousState: { status: previous },
        nextState: { status: next },
        metadata: { transportAssignmentId: assignment.id }
      }
    });

    return { assignmentId: assignment.id, orderStatus: next };
  });
}
