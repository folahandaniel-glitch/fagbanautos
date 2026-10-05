import { describe, it, expect } from "vitest";
import { computePricing, DEFAULT_PRICING_SETTINGS, type LineInput, type PricingSettings } from "../lib/pricing/engine";
import { evaluateRelease } from "../lib/pricing/release";
import { allocate, mulBps, nairaToKobo as N } from "../lib/money";
import { formatOrderNumber, lagosDateStamp } from "../lib/order-number";

const car = (price: number, over: Partial<LineInput> = {}): LineInput => ({
  id: "v1", productType: "VEHICLE", unitPrice: N(price), quantity: 1, vatApplicable: true, installmentEligible: true, ...over,
});

describe("money primitives", () => {
  it("mulBps rounds half up", () => {
    expect(mulBps(N(10_000_000), 750)).toBe(N(750_000));
    expect(mulBps(1, 5000)).toBe(1); // 0.5 -> 1
    expect(mulBps(1, 4999)).toBe(0);
  });
  it("allocate always sums to total", () => {
    for (const total of [0, 1, 7, 100, 99_999, 1_000_003]) {
      const parts = allocate(total, [3, 5, 11]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
  it("rejects non-integer kobo", () => {
    expect(() => mulBps(1.5, 750)).toThrow();
  });
});

describe("outright purchases", () => {
  it("outright + VAT: N10m -> N750k VAT -> N10.75m", () => {
    const r = computePricing({ lines: [car(10_000_000)], vatEnabled: true, mode: "OUTRIGHT" });
    expect(r.vatTotal).toBe(N(750_000));
    expect(r.grandTotal).toBe(N(10_750_000));
    expect(r.amountDueNow).toBe(N(10_750_000));
  });
  it("outright, VAT off: N10m -> N0 VAT -> N10m, and the removed VAT is recorded", () => {
    const r = computePricing({ lines: [car(10_000_000)], vatEnabled: false, mode: "OUTRIGHT" });
    expect(r.vatTotal).toBe(0);
    expect(r.grandTotal).toBe(N(10_000_000));
    expect(r.vatRemovedTotal).toBe(N(750_000));
  });
  it("discount + VAT", () => {
    const r = computePricing({ lines: [car(10_000_000, { discount: N(500_000) })], vatEnabled: true, mode: "OUTRIGHT" });
    expect(r.vatTotal).toBe(N(712_500));
    expect(r.grandTotal).toBe(N(10_212_500));
  });
  it("discount, VAT off", () => {
    const r = computePricing({ lines: [car(10_000_000, { discount: N(500_000) })], vatEnabled: false, mode: "OUTRIGHT" });
    expect(r.grandTotal).toBe(N(9_500_000));
  });
  it("non-VAT-applicable lines never attract VAT", () => {
    const r = computePricing({ lines: [car(1_000_000, { vatApplicable: false })], vatEnabled: true, mode: "OUTRIGHT" });
    expect(r.vatTotal).toBe(0);
  });
  it("trade-in is a part-payment: VAT on full price, balance reduced", () => {
    const r = computePricing({ lines: [car(10_000_000)], vatEnabled: true, mode: "OUTRIGHT", tradeInCredit: N(2_000_000) });
    expect(r.grandTotal).toBe(N(10_750_000));
    expect(r.amountDueNow).toBe(N(8_750_000));
  });
  it("trade-in, VAT off", () => {
    const r = computePricing({ lines: [car(10_000_000)], vatEnabled: false, mode: "OUTRIGHT", tradeInCredit: N(2_000_000) });
    expect(r.amountDueNow).toBe(N(8_000_000));
  });
  it("trade-in can alternatively reduce the taxable base", () => {
    const s: PricingSettings = { ...DEFAULT_PRICING_SETTINGS, tradeInTreatment: "REDUCES_TAXABLE_BASE" };
    const r = computePricing({ lines: [car(10_000_000)], vatEnabled: true, mode: "OUTRIGHT", tradeInCredit: N(2_000_000) }, s);
    expect(r.vatTotal).toBe(N(600_000));
  });
  it("coupon is allocated pro-rata and never makes price negative", () => {
    const r = computePricing({
      lines: [
        { id: "a", productType: "PART", unitPrice: N(10_000), quantity: 1, vatApplicable: true },
        { id: "b", productType: "ACCESSORY", unitPrice: N(30_000), quantity: 1, vatApplicable: true },
      ],
      couponDiscount: N(4_000), vatEnabled: true, mode: "OUTRIGHT",
    });
    expect(r.discountTotal).toBe(N(4_000));
    expect(r.lines[0].discounted + r.lines[1].discounted).toBe(N(36_000));
    const big = computePricing({ lines: [car(1_000)], couponDiscount: N(999_999), vatEnabled: true, mode: "OUTRIGHT" });
    expect(big.grandTotal).toBe(0);
  });
  it("delivery fee: taxable and non-taxable charges", () => {
    const r = computePricing({
      lines: [{ id: "p", productType: "PART", unitPrice: N(100_000), quantity: 2, vatApplicable: true }],
      charges: [{ code: "DELIVERY", label: "Delivery", amount: N(5_000), taxable: true }, { code: "RES", label: "Reservation", amount: N(10_000), taxable: false }],
      vatEnabled: true, mode: "OUTRIGHT",
    });
    expect(r.vatTotal).toBe(N(15_000) + N(375));
    expect(r.grandTotal).toBe(N(200_000) + N(15_375) + N(15_000));
  });
});

describe("installment purchases (+10%)", () => {
  it("installment, VAT off: N50m -> N55m, 90% threshold N49.5m", () => {
    const r = computePricing({ lines: [car(50_000_000)], vatEnabled: false, mode: "INSTALLMENT", deposit: N(10_000_000) }, DEFAULT_PRICING_SETTINGS);
    expect(r.upliftTotal).toBe(N(5_000_000));
    expect(r.grandTotal).toBe(N(55_000_000));
    expect(r.releaseThreshold).toBe(N(49_500_000));
    expect(evaluateRelease(N(49_499_999), r.releaseThreshold).state).toBe("BLOCKED");
    expect(evaluateRelease(N(49_500_000), r.releaseThreshold).state).toBe("ELIGIBLE");
  });
  it("installment + VAT (recommended VAT-inclusive basis)", () => {
    const r = computePricing({ lines: [car(50_000_000)], vatEnabled: true, mode: "INSTALLMENT" });
    expect(r.vatTotal).toBe(N(4_125_000));
    expect(r.grandTotal).toBe(N(59_125_000));
    expect(r.releaseThreshold).toBe(N(53_212_500));
    expect(evaluateRelease(N(53_212_499), r.releaseThreshold).state).toBe("BLOCKED");
    expect(evaluateRelease(N(53_212_500), r.releaseThreshold).state).toBe("ELIGIBLE");
  });
  it("installment + VAT on the pre-VAT basis (original rule) gives N49.5m", () => {
    const s: PricingSettings = { ...DEFAULT_PRICING_SETTINGS, thresholdBasis: "PRE_VAT_PRICE" };
    const r = computePricing({ lines: [car(50_000_000)], vatEnabled: true, mode: "INSTALLMENT" }, s);
    expect(r.releaseThreshold).toBe(N(49_500_000));
  });
  it("discount applies before the uplift", () => {
    const r = computePricing({ lines: [car(10_000_000, { discount: N(500_000) })], vatEnabled: true, mode: "INSTALLMENT" });
    expect(r.upliftTotal).toBe(N(950_000));
    expect(r.vatTotal).toBe(N(783_750));
    expect(r.grandTotal).toBe(N(11_233_750));
    expect(r.releaseThreshold).toBe(N(10_110_375));
  });
  it("installment + trade-in + VAT / no VAT stay consistent", () => {
    const on = computePricing({ lines: [car(20_000_000)], vatEnabled: true, mode: "INSTALLMENT", tradeInCredit: N(3_000_000), deposit: N(5_000_000) });
    const off = computePricing({ lines: [car(20_000_000)], vatEnabled: false, mode: "INSTALLMENT", tradeInCredit: N(3_000_000), deposit: N(5_000_000) });
    expect(on.grandTotal - off.grandTotal).toBe(on.vatTotal);
    expect(on.amountDueNow).toBe(N(5_000_000));
    expect(on.balanceAfterDueNow).toBe(on.grandTotal - N(3_000_000) - N(5_000_000));
  });
  it("non-eligible lines get no uplift even in installment mode", () => {
    const r = computePricing({ lines: [car(10_000_000, { installmentEligible: false })], vatEnabled: false, mode: "INSTALLMENT" });
    expect(r.upliftTotal).toBe(0);
  });
  it("per-vehicle uplift override", () => {
    const r = computePricing({ lines: [car(10_000_000, { installmentUpliftBps: 500 })], vatEnabled: false, mode: "INSTALLMENT" });
    expect(r.grandTotal).toBe(N(10_500_000));
  });
  it("never lets total drift: vat + base reconcile for many random prices", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 500; i++) {
      const price = Math.floor(rnd() * 90_000_000_00) + 1;
      const disc = Math.floor(rnd() * price);
      const r = computePricing({ lines: [{ id: "x", productType: "VEHICLE", unitPrice: price, quantity: 1, discount: disc, vatApplicable: true, installmentEligible: true }], vatEnabled: true, mode: "INSTALLMENT" });
      expect(r.grandTotal).toBe(r.lines[0].priced + r.vatTotal);
      expect(Number.isSafeInteger(r.grandTotal)).toBe(true);
      expect(r.releaseThreshold).toBeLessThanOrEqual(r.grandTotal);
    }
  });
});

describe("guards", () => {
  it("vehicle quantity must be 1", () => {
    expect(() => computePricing({ lines: [car(1_000_000, { quantity: 2 })], vatEnabled: true, mode: "OUTRIGHT" })).toThrow();
  });
  it("rejects negative or fractional kobo", () => {
    expect(() => computePricing({ lines: [car(-1)], vatEnabled: true, mode: "OUTRIGHT" })).toThrow();
    expect(() => computePricing({ lines: [{ ...car(1), unitPrice: 1.5 }], vatEnabled: true, mode: "OUTRIGHT" })).toThrow();
  });
  it("release override flips blocked to eligible and is flagged", () => {
    const e = evaluateRelease(0, 100, true);
    expect(e.state).toBe("ELIGIBLE");
    expect(e.overridden).toBe(true);
  });
});

describe("order numbers", () => {
  it("formats FAG-YYYYMMDD-NNNNNN", () => {
    expect(formatOrderNumber("20261005", 1)).toBe("FAG-20261005-000001");
    expect(formatOrderNumber("20261005", 123456)).toBe("FAG-20261005-123456");
  });
  it("uses Lagos date", () => {
    expect(lagosDateStamp(new Date("2026-10-05T23:30:00Z"))).toBe("20261006"); // +01:00
  });
});
