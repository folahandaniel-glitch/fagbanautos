import type { Kobo } from "../money";

export type ReleaseState = "ELIGIBLE" | "BLOCKED";

export interface ReleaseEvaluation {
  state: ReleaseState;
  paid: Kobo;
  threshold: Kobo;
  shortfall: Kobo;
  overridden: boolean;
}

/**
 * Pure release rule. `paid` must be the sum of VERIFIED payments only
 * (never pending, rejected or reversed). Callers load that sum from the ledger.
 * An explicit Super Admin override (with reason + audit, handled by the caller) flips BLOCKED to ELIGIBLE.
 */
export function evaluateRelease(paid: Kobo, threshold: Kobo, override = false): ReleaseEvaluation {
  if (!Number.isSafeInteger(paid) || paid < 0) throw new RangeError("paid must be a non-negative integer");
  if (!Number.isSafeInteger(threshold) || threshold < 0) throw new RangeError("threshold must be a non-negative integer");
  const meets = paid >= threshold;
  return {
    state: meets || override ? "ELIGIBLE" : "BLOCKED",
    paid,
    threshold,
    shortfall: meets ? 0 : threshold - paid,
    overridden: !meets && override,
  };
}
