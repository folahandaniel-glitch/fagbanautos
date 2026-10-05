import type { OrderStatus } from "@prisma/client";

/** Permitted order transitions. Anything not listed is rejected server-side. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_VERIFICATION", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  PAYMENT_VERIFICATION: ["PENDING_PAYMENT", "PARTIALLY_PAID", "PAID", "CANCELLED"],
  PARTIALLY_PAID: ["PAYMENT_VERIFICATION", "PAID", "RESERVED", "PROCESSING", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "CANCELLED", "REFUNDED"],
  PAID: ["PROCESSING", "RESERVED", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "CANCELLED", "REFUNDED"],
  PROCESSING: ["RESERVED", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "CANCELLED", "REFUNDED"],
  RESERVED: ["PROCESSING", "PAID", "PARTIALLY_PAID", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_COLLECTION: ["DELIVERED", "COMPLETED", "PROCESSING"],
  READY_FOR_DELIVERY: ["DELIVERED", "PROCESSING"],
  DELIVERED: ["COMPLETED", "REFUNDED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** States in which a vehicle physically leaves FAGDAN's custody (or is prepared to). Gated by the release rule. */
export const RELEASE_GATED: OrderStatus[] = ["READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "DELIVERED", "COMPLETED"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {}
export class ReleaseBlockedError extends Error {}

/**
 * Pure guard. `hasVehicle` + installment + not-eligible => ReleaseBlockedError.
 * `releaseEligible` is computed by the caller from VERIFIED payments only.
 */
export function assertTransition(opts: {
  from: OrderStatus;
  to: OrderStatus;
  hasVehicle: boolean;
  installment: boolean;
  releaseEligible: boolean;
  fullyPaid: boolean;
}): void {
  const { from, to, hasVehicle, installment, releaseEligible, fullyPaid } = opts;
  if (!canTransition(from, to)) throw new TransitionError(`Order cannot move from ${from} to ${to}`);
  if (hasVehicle && RELEASE_GATED.includes(to)) {
    if (installment && !releaseEligible) throw new ReleaseBlockedError("RELEASE BLOCKED: the 90% payment threshold has not been met");
    if (!installment && !fullyPaid) throw new ReleaseBlockedError("RELEASE BLOCKED: outright purchase is not fully paid");
  }
}
