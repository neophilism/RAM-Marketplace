import type { OrderStatus } from "./domain";

export type ReceiptDecisionInput = "ACCEPT" | "REJECT";

export function nextOrderStatusForReceiptDecision(
  current: OrderStatus,
  decision: ReceiptDecisionInput
): OrderStatus {
  if (current !== "DELIVERED") {
    throw new Error("Receiving inspection is available only after carrier delivery");
  }

  return decision === "ACCEPT" ? "ACCEPTED" : "REJECTED_AT_RECEIPT";
}
