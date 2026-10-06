import type { OrderStatus } from "./domain";

export const TRANSPORT_EVENT_TYPES = [
  "PICKUP_CONFIRMED",
  "DELIVERY_CONFIRMED",
  "EXCEPTION_REPORTED",
  "RESUME_TRANSIT"
] as const;

export type TransportEventType = (typeof TRANSPORT_EVENT_TYPES)[number];

export function assertTransportAssignmentEligible(status: OrderStatus) {
  if (status !== "READY_FOR_PICKUP") {
    throw new Error("Transport may be assigned only after RAM clearance");
  }
}

export function nextOrderStatusForTransportEvent(
  current: OrderStatus,
  eventType: TransportEventType
): OrderStatus {
  if (eventType === "PICKUP_CONFIRMED" && current === "READY_FOR_PICKUP") {
    return "IN_TRANSIT";
  }

  if (
    eventType === "EXCEPTION_REPORTED" &&
    (current === "READY_FOR_PICKUP" || current === "IN_TRANSIT")
  ) {
    return "TRANSPORT_EXCEPTION";
  }

  if (eventType === "RESUME_TRANSIT" && current === "TRANSPORT_EXCEPTION") {
    return "IN_TRANSIT";
  }

  if (
    eventType === "DELIVERY_CONFIRMED" &&
    (current === "IN_TRANSIT" || current === "TRANSPORT_EXCEPTION")
  ) {
    return "DELIVERED";
  }

  throw new Error(`Invalid transport event ${eventType} for order status ${current}`);
}
