import "server-only";
import type { TransportEventType } from "@/lib/logistics-policy";

export interface PrototypeTransportEvent {
  id: string;
  type: TransportEventType | "ASSIGNED";
  actorUserId: string;
  occurredAt: string;
  notes?: string;
  sanitationConfirmed?: boolean;
  custodyAttested: boolean;
  previousOrderStatus?: string;
  nextOrderStatus?: string;
}

export interface PrototypeTransportAssignment {
  id: string;
  orderId: string;
  transportOrganizationId: string;
  assignedTransportUserId?: string;
  assignedByUserId: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  movementDocumentRefs: string[];
  sanitationRequirements?: string;
  specialInstructions?: string;
  assignedAt: string;
  events: PrototypeTransportEvent[];
}

declare global {
  // eslint-disable-next-line no-var
  var __ramPrototypeTransportAssignments: PrototypeTransportAssignment[] | undefined;
}

function records() {
  if (!globalThis.__ramPrototypeTransportAssignments) {
    globalThis.__ramPrototypeTransportAssignments = [];
  }
  return globalThis.__ramPrototypeTransportAssignments;
}

export function listPrototypeTransportAssignments() {
  return [...records()];
}

export function getPrototypeTransportAssignment(id: string) {
  return records().find((assignment) => assignment.id === id);
}

export function getPrototypeTransportAssignmentForOrder(orderId: string) {
  return records().find((assignment) => assignment.orderId === orderId);
}

export function savePrototypeTransportAssignment(
  input: Omit<PrototypeTransportAssignment, "id" | "assignedAt" | "events">
) {
  if (getPrototypeTransportAssignmentForOrder(input.orderId)) {
    throw new Error("Order already has a transport assignment");
  }

  const assignedAt = new Date().toISOString();
  const assignment: PrototypeTransportAssignment = {
    ...input,
    id: `TA-${String(records().length + 1).padStart(6, "0")}`,
    assignedAt,
    events: [
      {
        id: "TE-000001",
        type: "ASSIGNED",
        actorUserId: input.assignedByUserId,
        occurredAt: assignedAt,
        notes: "Transport assignment created after clearance.",
        custodyAttested: false
      }
    ]
  };
  records().unshift(assignment);
  return assignment;
}

export function addPrototypeTransportEvent(
  assignmentId: string,
  event: Omit<PrototypeTransportEvent, "id" | "occurredAt">
) {
  const assignment = getPrototypeTransportAssignment(assignmentId);
  if (!assignment) throw new Error("Transport assignment not found");

  const saved: PrototypeTransportEvent = {
    ...event,
    id: `TE-${String(assignment.events.length + 1).padStart(6, "0")}`,
    occurredAt: new Date().toISOString()
  };
  assignment.events.push(saved);
  return saved;
}
