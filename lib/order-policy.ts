import type { OrderStatus } from "./domain";
import { canTransitionOrder } from "./state-machines";

export interface OrderTransitionContext {
  from: OrderStatus;
  to: OrderStatus;
  blockingComplianceFindings?: number;
}

/**
 * Compliance is a hard gate. A blocked order cannot become READY_FOR_PICKUP,
 * even when the state transition would otherwise be valid.
 */
export function canAdvanceOrder(context: OrderTransitionContext): boolean {
  if (!canTransitionOrder(context.from, context.to)) return false;

  if (
    context.to === "READY_FOR_PICKUP" &&
    (context.blockingComplianceFindings ?? 0) > 0
  ) {
    return false;
  }

  return true;
}
