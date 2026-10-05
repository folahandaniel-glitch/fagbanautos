/**
 * Money helpers. All money in this codebase is an integer number of kobo (1 NGN = 100 kobo).
 * Floating point is never used for money arithmetic: percentage maths goes through BigInt.
 */
export type Kobo = number;

export function assertKobo(v: number, label = "amount"): void {
  if (!Number.isSafeInteger(v)) throw new RangeError(`${label} must be an integer number of kobo, got ${v}`);
}

/** amount * bps / 10_000, rounded half up (bps = basis points; 750 = 7.5%). */
export function mulBps(amount: Kobo, bps: number): Kobo {
  assertKobo(amount);
  if (!Number.isInteger(bps) || bps < 0) throw new RangeError(`bps must be a non-negative integer, got ${bps}`);
  return Number((BigInt(amount) * BigInt(bps) + 5000n) / 10000n);
}

/** Split `total` across `weights` so the parts always sum exactly to `total` (largest remainder). */
export function allocate(total: Kobo, weights: number[]): Kobo[] {
  assertKobo(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const T = BigInt(total);
  const S = BigInt(sum);
  const base = weights.map((w) => (T * BigInt(w)) / S);
  let rest = T - base.reduce((a, b) => a + b, 0n);
  const order = weights
    .map((w, i) => ({ i, rem: (T * BigInt(w)) % S }))
    .sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  for (const { i } of order) {
    if (rest <= 0n) break;
    base[i] += 1n;
    rest -= 1n;
  }
  return base.map(Number);
}

export const nairaToKobo = (naira: number): Kobo => Math.round(naira * 100);
export const koboToNaira = (kobo: Kobo): number => kobo / 100;

const ngn = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
const ngnWhole = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export function formatNaira(kobo: Kobo, opts: { whole?: boolean } = {}): string {
  const naira = kobo / 100;
  const whole = opts.whole ?? Number.isInteger(naira);
  return (whole ? ngnWhole : ngn).format(naira);
}
