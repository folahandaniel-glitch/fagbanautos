/**
 * Central pricing engine. The ONLY place order totals are computed.
 * Used by cart, checkout, payment initialisation, invoices, admin and confirmation screens.
 *
 * Fixed calculation order (see docs/PRICING.md):
 *  1. base price           unit price x quantity
 *  2. discounts            line discount, then coupon (pro-rata) -> discounted price D (>= 0)
 *  3. installment uplift   I = D + uplift% x D          (installment-eligible vehicle lines only)
 *  4. taxable base         T = I (or D) for VAT-applicable lines
 *  5. VAT                  rate x T, only where VAT is on for that line
 *  6. charges              delivery / service / reservation / other, each taxable or not
 *  7. credits              trade-in credit (part-payment by default)
 *  8. grand total          T-lines + VAT + charges (+ VAT on taxable charges)
 *
 * All values are integer kobo. Rounding: half up, once per line.
 */
import { allocate, mulBps, type Kobo, assertKobo } from "../money";

export type PaymentMode = "OUTRIGHT" | "INSTALLMENT";
export type ThresholdBasis = "VAT_INCLUSIVE_TOTAL" | "PRE_VAT_PRICE";
export type TradeInTreatment = "PART_PAYMENT" | "REDUCES_TAXABLE_BASE";

export interface PricingSettings {
  vatRateBps: number; // 750 = 7.5%
  installmentUpliftBps: number; // 1000 = 10%
  releaseThresholdBps: number; // 9000 = 90%
  thresholdBasis: ThresholdBasis;
  tradeInTreatment: TradeInTreatment;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  vatRateBps: 750,
  installmentUpliftBps: 1000,
  releaseThresholdBps: 9000,
  thresholdBasis: "VAT_INCLUSIVE_TOTAL",
  tradeInTreatment: "PART_PAYMENT",
};

export interface LineInput {
  id: string;
  productType: "VEHICLE" | "PART" | "ACCESSORY" | "TECHNOLOGY" | "SERVICE" | "OTHER";
  unitPrice: Kobo;
  quantity: number;
  discount?: Kobo; // total line discount in kobo
  vatApplicable: boolean; // product/category is subject to VAT
  vatOff?: boolean; // buyer exemption approved for this line
  installmentEligible?: boolean;
  /** per-vehicle uplift override in bps (otherwise settings default) */
  installmentUpliftBps?: number;
}

export interface ChargeInput {
  code: string;
  label: string;
  amount: Kobo;
  taxable: boolean;
}

export interface PricingInput {
  lines: LineInput[];
  charges?: ChargeInput[];
  couponDiscount?: Kobo;
  tradeInCredit?: Kobo;
  vatEnabled: boolean; // order-level master switch (false = buyer VAT exemption in force)
  mode: PaymentMode;
  deposit?: Kobo; // amount due now for installment orders; defaults to full for outright
}

export interface LineResult {
  id: string;
  quantity: number;
  base: Kobo;
  discount: Kobo; // line + allocated coupon
  discounted: Kobo; // D
  uplift: Kobo;
  priced: Kobo; // I or D
  vat: Kobo;
  vatRemoved: Kobo; // VAT that would have applied but was switched off
  vatApplied: boolean;
}

export interface PricingResult {
  lines: LineResult[];
  charges: { code: string; label: string; amount: Kobo; taxable: boolean; vat: Kobo }[];
  subtotal: Kobo; // sum of base
  discountTotal: Kobo;
  upliftTotal: Kobo;
  taxableBase: Kobo;
  vatRateBps: number;
  vatTotal: Kobo;
  vatRemovedTotal: Kobo;
  chargesTotal: Kobo;
  tradeInCredit: Kobo;
  grandTotal: Kobo;
  amountDueNow: Kobo;
  balanceAfterDueNow: Kobo;
  /** Cash that must be verified before a vehicle can be released (installment orders). */
  releaseThreshold: Kobo;
  mode: PaymentMode;
}

function clampNonNeg(n: number): number {
  return n < 0 ? 0 : n;
}

export function computePricing(input: PricingInput, settings: PricingSettings = DEFAULT_PRICING_SETTINGS): PricingResult {
  const { lines, charges = [], mode } = input;
  for (const l of lines) {
    assertKobo(l.unitPrice, `unitPrice(${l.id})`);
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new RangeError(`quantity(${l.id}) must be >= 1`);
    if (l.productType === "VEHICLE" && l.quantity !== 1) throw new RangeError("vehicle quantity must be 1");
    if (l.unitPrice < 0) throw new RangeError(`unitPrice(${l.id}) cannot be negative`);
  }
  const coupon = input.couponDiscount ?? 0;
  const tradeIn = input.tradeInCredit ?? 0;
  if (coupon < 0 || tradeIn < 0) throw new RangeError("discounts and credits cannot be negative");

  // 1-2. base and line discounts
  const bases = lines.map((l) => l.unitPrice * l.quantity);
  const lineDisc = lines.map((l, i) => Math.min(l.discount ?? 0, bases[i]));
  const afterLine = bases.map((b, i) => b - lineDisc[i]);

  // coupon allocated pro-rata to what remains
  const couponTotal = Math.min(coupon, afterLine.reduce((a, b) => a + b, 0));
  const couponParts = allocate(couponTotal, afterLine);
  const discounted = afterLine.map((v, i) => clampNonNeg(v - couponParts[i]));

  const results: LineResult[] = lines.map((l, i) => {
    const D = discounted[i];
    const wantsInstallment = mode === "INSTALLMENT" && l.installmentEligible === true;
    const upliftBps = l.installmentUpliftBps ?? settings.installmentUpliftBps;
    const uplift = wantsInstallment ? mulBps(D, upliftBps) : 0; // 3
    const priced = D + uplift;
    const taxable = l.vatApplicable ? priced : 0; // 4
    const vatWouldBe = mulBps(taxable, settings.vatRateBps); // 5
    const vatOn = input.vatEnabled && !l.vatOff;
    return {
      id: l.id,
      quantity: l.quantity,
      base: bases[i],
      discount: lineDisc[i] + couponParts[i],
      discounted: D,
      uplift,
      priced,
      vat: vatOn ? vatWouldBe : 0,
      vatRemoved: vatOn ? 0 : vatWouldBe,
      vatApplied: vatOn && l.vatApplicable,
    };
  });

  // Trade-in as taxable-base reduction (alternative treatment, off by default)
  if (settings.tradeInTreatment === "REDUCES_TAXABLE_BASE" && tradeIn > 0) {
    const taxableAmounts = results.map((r, i) => (lines[i].vatApplicable ? r.priced : 0));
    const parts = allocate(Math.min(tradeIn, taxableAmounts.reduce((a, b) => a + b, 0)), taxableAmounts);
    results.forEach((r, i) => {
      const newTaxable = clampNonNeg(taxableAmounts[i] - parts[i]);
      const would = mulBps(newTaxable, settings.vatRateBps);
      const vatOn = input.vatEnabled && !lines[i].vatOff;
      r.vat = vatOn ? would : 0;
      r.vatRemoved = vatOn ? 0 : would;
    });
  }

  const chargeResults = charges.map((c) => {
    assertKobo(c.amount, `charge(${c.code})`);
    if (c.amount < 0) throw new RangeError(`charge(${c.code}) cannot be negative`);
    const vatWould = c.taxable ? mulBps(c.amount, settings.vatRateBps) : 0;
    return { ...c, vat: input.vatEnabled ? vatWould : 0, _would: vatWould };
  });

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const subtotal = sum(bases);
  const discountTotal = sum(results.map((r) => r.discount));
  const upliftTotal = sum(results.map((r) => r.uplift));
  const pricedTotal = sum(results.map((r) => r.priced));
  const taxableBase = sum(results.map((r, i) => (lines[i].vatApplicable ? r.priced : 0)));
  const vatLines = sum(results.map((r) => r.vat));
  const vatCharges = sum(chargeResults.map((c) => c.vat));
  const vatTotal = vatLines + vatCharges;
  const vatRemovedTotal = sum(results.map((r) => r.vatRemoved)) + sum(chargeResults.map((c) => (input.vatEnabled ? 0 : c._would)));
  const chargesTotal = sum(chargeResults.map((c) => c.amount));

  const grossPayable = pricedTotal + vatTotal + chargesTotal;
  const grandTotal = grossPayable; // trade-in is a credit shown separately below
  const payableAfterCredit = clampNonNeg(grandTotal - (settings.tradeInTreatment === "PART_PAYMENT" ? tradeIn : 0));

  let amountDueNow = payableAfterCredit;
  if (mode === "INSTALLMENT") {
    const dep = input.deposit ?? 0;
    if (dep < 0) throw new RangeError("deposit cannot be negative");
    amountDueNow = Math.min(dep, payableAfterCredit);
  }

  // Release threshold (only meaningful for installment orders)
  let releaseThreshold = 0;
  if (mode === "INSTALLMENT") {
    const basis = settings.thresholdBasis === "VAT_INCLUSIVE_TOTAL" ? grandTotal : pricedTotal;
    releaseThreshold = mulBps(basis, settings.releaseThresholdBps);
  }

  return {
    lines: results,
    charges: chargeResults.map(({ _would, ...rest }) => {
      void _would;
      return rest;
    }),
    subtotal,
    discountTotal,
    upliftTotal,
    taxableBase,
    vatRateBps: settings.vatRateBps,
    vatTotal,
    vatRemovedTotal,
    chargesTotal,
    tradeInCredit: tradeIn,
    grandTotal,
    amountDueNow,
    balanceAfterDueNow: clampNonNeg(payableAfterCredit - amountDueNow),
    releaseThreshold,
    mode,
  };
}
