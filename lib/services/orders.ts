import { Prisma, type OrderStatus, type ProductType } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { getSettings, getPricingSettings } from "../settings";
import { computePricing, type ChargeInput, type LineInput, type PricingInput, type PricingResult, type PricingSettings } from "../pricing/engine";
import { evaluateRelease } from "../pricing/release";
import { formatOrderNumber, lagosDateStamp } from "../order-number";
import { assertTransition, ReleaseBlockedError } from "../orders/state";
import { nairaToKobo } from "../money";

type Tx = Prisma.TransactionClient;

export class OrderError extends Error {
  constructor(message: string, public code: "UNAVAILABLE" | "INVALID" | "VAT_NOT_ALLOWED" | "COUPON" | "STATE" = "INVALID") {
    super(message);
  }
}

export interface CartLine { productId: string; quantity: number }

export interface QuoteInput {
  lines: CartLine[];
  mode: "OUTRIGHT" | "INSTALLMENT";
  deposit?: number; // kobo, installment only
  vatOffRequested?: boolean;
  deliveryMethod?: "PICKUP" | "DELIVERY";
  couponCode?: string;
  tradeInCredit?: number; // kobo, validated by caller against an accepted TradeIn
}

export interface Quote {
  pricing: PricingResult;
  vatEnabled: boolean;
  vatOffAllowed: boolean;
  vatOffReason?: string;
  lines: { productId: string; name: string; sku: string; type: ProductType; quantity: number; unitPrice: number; image?: string }[];
  hasVehicle: boolean;
  minDeposit: number;
  couponApplied?: string;
  /** Exact engine inputs, stored on the order so totals can be recalculated reproducibly. */
  pricingInput: PricingInput;
  pricingSettings: PricingSettings;
}

const VAT_FLAG: Partial<Record<ProductType, string>> = {
  VEHICLE: "vat.disableForVehicles",
  PART: "vat.disableForAccessories",
  ACCESSORY: "vat.disableForAccessories",
  TECHNOLOGY: "vat.disableForAccessories",
  SERVICE: "vat.disableForServices",
};

async function lockProducts(tx: Tx, ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  // Deterministic order prevents deadlocks between concurrent checkouts.
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

async function resolveCoupon(tx: Tx, code: string | undefined, base: number): Promise<{ amount: number; code?: string }> {
  if (!code) return { amount: 0 };
  const c = await tx.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  if (!c || !c.isActive) throw new OrderError("This coupon is not valid.", "COUPON");
  if ((c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt < now)) throw new OrderError("This coupon is not currently active.", "COUPON");
  if (c.maxUses != null && c.used >= c.maxUses) throw new OrderError("This coupon has been fully redeemed.", "COUPON");
  if (base < Number(c.minSpend)) throw new OrderError("Your basket does not meet the coupon's minimum spend.", "COUPON");
  const amount = c.amountOff != null ? Number(c.amountOff) : c.percentBps != null ? Math.round((base * c.percentBps) / 10000) : 0;
  return { amount: Math.min(amount, base), code: c.code };
}

/**
 * THE authoritative quote. Prices, stock, VAT permission, coupon and totals all come from the server.
 * Used by the cart preview, checkout, payment initialisation and invoices.
 */
export async function buildQuote(input: QuoteInput, tx: Tx | typeof db = db): Promise<Quote> {
  if (input.lines.length === 0) throw new OrderError("Your cart is empty.");
  const products = await tx.product.findMany({
    where: { id: { in: input.lines.map((l) => l.productId) } },
    include: { category: true, vehicle: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const settings = await getSettings();
  const pricingSettings = await getPricingSettings();

  const lines: LineInput[] = [];
  const outLines: Quote["lines"] = [];
  for (const l of input.lines) {
    const p = byId.get(l.productId);
    if (!p || p.status !== "ACTIVE") throw new OrderError("An item in your cart is no longer available.", "UNAVAILABLE");
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99) throw new OrderError("Invalid quantity.");
    if (p.type === "VEHICLE" && l.quantity !== 1) throw new OrderError("Vehicles can only be bought one at a time.");
    const unitDiscount = Number(p.discount);
    lines.push({
      id: p.id,
      productType: p.type,
      unitPrice: Number(p.price),
      quantity: l.quantity,
      discount: unitDiscount * l.quantity,
      vatApplicable: p.vatApplicable && (p.category?.vatApplicable ?? true),
      installmentEligible: p.type === "VEHICLE" && !!p.vehicle?.installmentAvailable,
      installmentUpliftBps: p.vehicle?.installmentUpliftBps ?? undefined,
    });
    outLines.push({ productId: p.id, name: p.name, sku: p.sku, type: p.type, quantity: l.quantity, unitPrice: Number(p.price), image: p.images[0]?.url });
  }
  const hasVehicle = outLines.some((l) => l.type === "VEHICLE");
  if (input.mode === "INSTALLMENT" && !lines.some((l) => l.installmentEligible)) {
    throw new OrderError("None of the selected vehicles are available on FAGDAN installment terms.");
  }

  // VAT: default on; buyer may switch off only if Super Admin policy allows it for every item type in the order.
  let vatOffAllowed = false;
  if (settings["vat.buyerCanDisable"] === true) {
    vatOffAllowed = outLines.every((l) => {
      const flag = VAT_FLAG[l.type];
      return flag ? settings[flag] === true : false;
    });
  }
  if (input.vatOffRequested && !vatOffAllowed) throw new OrderError("VAT cannot be switched off for this order.", "VAT_NOT_ALLOWED");
  const vatEnabled = input.vatOffRequested ? false : settings["vat.enabledDefault"] === true;

  const charges: ChargeInput[] = [];
  const hasNonVehicle = outLines.some((l) => l.type !== "VEHICLE");
  if (input.deliveryMethod === "DELIVERY" && hasNonVehicle) {
    charges.push({ code: "DELIVERY", label: "Delivery fee", amount: nairaToKobo(Number(settings["orders.deliveryFeeNaira"])), taxable: settings["orders.deliveryFeeTaxable"] === true });
  }

  const baseForCoupon = lines.reduce((a, l) => a + l.unitPrice * l.quantity - (l.discount ?? 0), 0);
  const coupon = await resolveCoupon(tx as Tx, input.couponCode, baseForCoupon);

  const pricingInput: PricingInput = {
    lines, charges, couponDiscount: coupon.amount, tradeInCredit: input.tradeInCredit ?? 0,
    vatEnabled, mode: input.mode, deposit: input.deposit,
  };
  const pricing = computePricing(pricingInput, pricingSettings);

  const minDeposit = Math.round((pricing.grandTotal * Number(settings["installment.minDepositBps"] ?? 0)) / 10000);
  return { pricing, vatEnabled, vatOffAllowed, lines: outLines, hasVehicle, minDeposit, couponApplied: coupon.code, pricingInput, pricingSettings };
}

export interface CreateOrderInput extends QuoteInput {
  customerId: string;
  actorId?: string | null;
  delivery?: { address?: string; city?: string; state?: string; contact?: string };
  vatOffReason?: string;
  vatEvidenceUrl?: string;
  notes?: string;
  isDemo?: boolean;
  ip?: string;
  sessionId?: string;
}

export async function createOrder(input: CreateOrderInput) {
  await sweepExpiredReservations();
  const settings = await getSettings();
  const holdHours = Number(settings["inventory.reservationHoldHours"]);
  const requireReason = settings["vat.requireReason"] === true;
  const requireApproval = settings["vat.requireApproval"] === true;
  // Sample (demo) listings cannot be bought unless the owner has switched that on (testing only).
  if (!input.isDemo && settings["catalogue.allowDemoPurchases"] !== true) {
    const demo = await db.product.count({ where: { id: { in: input.lines.map((l) => l.productId) }, isDemo: true } });
    if (demo > 0) throw new OrderError("This is a sample listing and cannot be purchased online. Please contact us to enquire about similar stock.", "UNAVAILABLE");
  }
  if (input.vatOffRequested && requireReason && !(input.vatOffReason && input.vatOffReason.trim().length >= 5)) {
    throw new OrderError("Please state the reason for switching VAT off.", "VAT_NOT_ALLOWED");
  }

  return db.$transaction(
    async (tx) => {
      await lockProducts(tx, input.lines.map((l) => l.productId));
      const quote = await buildQuote(input, tx);
      const { pricing } = quote;

      if (input.mode === "INSTALLMENT") {
        const dep = input.deposit ?? 0;
        if (dep < quote.minDeposit) throw new OrderError(`The minimum deposit is ${(quote.minDeposit / 100).toLocaleString("en-NG")} NGN.`);
      }

      // Availability, checked under row locks
      const products = await tx.product.findMany({ where: { id: { in: input.lines.map((l) => l.productId) } } });
      for (const l of input.lines) {
        const p = products.find((x) => x.id === l.productId)!;
        const available = p.stockOnHand - p.stockReserved;
        if (available < l.quantity && !(p.allowBackorder && p.type !== "VEHICLE")) {
          throw new OrderError(`"${p.name}" is no longer available.`, "UNAVAILABLE");
        }
      }

      const stamp = lagosDateStamp();
      const counter = await tx.orderCounter.upsert({ where: { dateStamp: stamp }, create: { dateStamp: stamp, seq: 1 }, update: { seq: { increment: 1 } } });
      const orderNumber = formatOrderNumber(stamp, counter.seq);

      const vatPending = !!input.vatOffRequested && requireApproval;
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: input.customerId,
          status: "PENDING_PAYMENT",
          paymentMode: input.mode,
          subtotal: BigInt(pricing.subtotal),
          discountTotal: BigInt(pricing.discountTotal),
          upliftTotal: BigInt(pricing.upliftTotal),
          vatTotal: BigInt(pricing.vatTotal),
          vatRateBps: pricing.vatRateBps,
          vatEnabled: quote.vatEnabled,
          vatExemptionStatus: input.vatOffRequested ? (vatPending ? "PENDING_APPROVAL" : "APPLIED") : null,
          chargesTotal: BigInt(pricing.chargesTotal),
          tradeInCredit: BigInt(pricing.tradeInCredit),
          grandTotal: BigInt(pricing.grandTotal),
          releaseThreshold: BigInt(pricing.releaseThreshold),
          releaseState: input.mode === "INSTALLMENT" ? "BLOCKED" : null,
          pricingSnapshot: JSON.parse(JSON.stringify({ ...pricing, _input: quote.pricingInput, _settings: quote.pricingSettings })) as Prisma.InputJsonValue,
          deliveryMethod: input.deliveryMethod ?? "PICKUP",
          deliveryAddress: input.delivery?.address,
          deliveryCity: input.delivery?.city,
          deliveryState: input.delivery?.state,
          deliveryContact: input.delivery?.contact,
          deliveryFee: BigInt(pricing.charges.find((c) => c.code === "DELIVERY")?.amount ?? 0),
          couponCode: quote.couponApplied,
          notes: input.notes,
          isDemo: input.isDemo ?? false,
          items: {
            create: quote.lines.map((l, i) => ({
              productId: l.productId, name: l.name, sku: l.sku, quantity: l.quantity,
              unitPrice: BigInt(l.unitPrice),
              discount: BigInt(pricing.lines[i].discount),
              uplift: BigInt(pricing.lines[i].uplift),
              vat: BigInt(pricing.lines[i].vat),
              lineTotal: BigInt(pricing.lines[i].priced + pricing.lines[i].vat),
            })),
          },
          history: { create: { toStatus: "PENDING_PAYMENT", actorId: input.actorId ?? undefined, note: "Order created" } },
        },
      });

      if (input.mode === "INSTALLMENT") {
        const s = await getPricingSettings();
        await tx.installmentPlan.create({
          data: {
            orderId: order.id,
            outrightPrice: BigInt(pricing.subtotal - pricing.discountTotal),
            installmentPrice: BigInt(pricing.subtotal - pricing.discountTotal + pricing.upliftTotal),
            upliftBps: s.installmentUpliftBps,
            thresholdBps: s.releaseThresholdBps,
            thresholdKobo: BigInt(pricing.releaseThreshold),
            deposit: BigInt(input.deposit ?? 0),
          },
        });
      }

      if (input.vatOffRequested) {
        await tx.vatRecord.create({
          data: {
            orderId: order.id, customerId: input.customerId, previousState: true, newState: false,
            vatRemoved: BigInt(pricing.vatRemovedTotal), reason: input.vatOffReason, evidenceUrl: input.vatEvidenceUrl,
            status: vatPending ? "PENDING_APPROVAL" : "APPLIED", ip: input.ip, sessionId: input.sessionId,
          },
        });
        await audit({ actorId: input.actorId, action: "vat.switch_off", targetType: "Order", targetId: order.id, before: { vat: true }, after: { vat: false, vatRemoved: pricing.vatRemovedTotal }, reason: input.vatOffReason }, tx);
      }

      // Reserve stock
      for (const l of input.lines) {
        const p = products.find((x) => x.id === l.productId)!;
        await tx.product.update({ where: { id: p.id }, data: { stockReserved: { increment: l.quantity } } });
        await tx.stockMovement.create({ data: { productId: p.id, type: "RESERVE", quantity: l.quantity, orderId: order.id, reason: `Order ${orderNumber}` } });
        if (p.type === "VEHICLE") {
          await tx.reservation.create({
            data: { productId: p.id, customerId: input.customerId, orderId: order.id, quantity: 1, expiresAt: new Date(Date.now() + holdHours * 3600_000), deposit: BigInt(input.deposit ?? 0) },
          });
        }
      }
      if (quote.couponApplied) await tx.coupon.update({ where: { code: quote.couponApplied }, data: { used: { increment: 1 } } });

      await audit({ actorId: input.actorId, action: "order.create", targetType: "Order", targetId: order.id, after: { orderNumber, grandTotal: pricing.grandTotal } }, tx);
      return order;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
  );
}

/** Amount still owed after verified payments and trade-in credit. */
export function payable(order: { grandTotal: bigint; tradeInCredit: bigint }): number {
  return Math.max(0, Number(order.grandTotal) - Number(order.tradeInCredit));
}

/**
 * Apply a VERIFIED payment to an order. Idempotent: the ledger's unique (paymentId,type) rejects replays,
 * so a repeated webhook can never double-credit.
 */
export async function applyVerifiedPayment(opts: { paymentId: string; paidAmount: number; gatewayReference?: string; actorId?: string | null; note?: string }) {
  return db.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id: opts.paymentId } });
    if (!pay) throw new OrderError("Payment not found");
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${pay.orderId} FOR UPDATE`;
    const existing = await tx.ledgerEntry.findUnique({ where: { paymentId_type: { paymentId: pay.id, type: "PAYMENT" } } });
    if (existing) return { order: await tx.order.findUniqueOrThrow({ where: { id: pay.orderId } }), duplicate: true };
    if (!Number.isSafeInteger(opts.paidAmount) || opts.paidAmount <= 0) throw new OrderError("Invalid payment amount");

    await tx.payment.update({
      where: { id: pay.id },
      data: { status: "SUCCESS", paidAmount: BigInt(opts.paidAmount), gatewayReference: opts.gatewayReference ?? pay.gatewayReference, verifiedById: opts.actorId ?? undefined, verifiedAt: new Date() },
    });
    await tx.ledgerEntry.create({ data: { orderId: pay.orderId, paymentId: pay.id, type: "PAYMENT", amount: BigInt(opts.paidAmount), note: opts.note, actorId: opts.actorId ?? undefined } });
    const sum = await tx.ledgerEntry.aggregate({ where: { orderId: pay.orderId }, _sum: { amount: true } });
    const paid = Number(sum._sum.amount ?? 0n);

    const order = await tx.order.findUniqueOrThrow({ where: { id: pay.orderId }, include: { items: { include: { product: true } } } });
    const owed = payable(order);
    let status: OrderStatus = order.status;
    if (["PENDING_PAYMENT", "PAYMENT_VERIFICATION", "PARTIALLY_PAID"].includes(order.status)) {
      status = paid >= owed ? "PAID" : "PARTIALLY_PAID";
    }
    const isInstallment = order.paymentMode === "INSTALLMENT";
    let releaseState = order.releaseState;
    if (isInstallment) {
      const ev = evaluateRelease(paid, Number(order.releaseThreshold));
      releaseState = ev.state;
      if (ev.state !== order.releaseState) {
        await tx.releaseDecision.create({ data: { orderId: order.id, state: ev.state, paid: BigInt(paid), threshold: order.releaseThreshold } });
      }
    }
    const updated = await tx.order.update({ where: { id: order.id }, data: { amountPaid: BigInt(paid), status, releaseState } });
    if (status !== order.status) {
      await tx.orderStateHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: status, actorId: opts.actorId ?? undefined, note: "Payment verified" } });
    }
    // First verified money firms up the vehicle reservation (no more expiry).
    await tx.reservation.updateMany({ where: { orderId: order.id, status: "ACTIVE" }, data: { status: "CONVERTED" } });
    await audit({ actorId: opts.actorId, action: "payment.verified", targetType: "Payment", targetId: pay.id, after: { orderId: order.id, amount: opts.paidAmount, paid, status } }, tx);
    return { order: updated, duplicate: false };
  });
}

/** Move an order through the state machine; the release rule is enforced here, not in the UI. */
export async function transitionOrder(orderId: string, to: OrderStatus, actor: { id: string; canOverrideRelease?: boolean }, note?: string, overrideReason?: string) {
  try {
    return await transitionOrderTx(orderId, to, actor, note, overrideReason);
  } catch (e) {
    // Denied release attempts are audited OUTSIDE the rolled-back transaction so the record survives.
    if (e instanceof ReleaseBlockedError) {
      await audit({ actorId: actor.id, action: "release.denied", targetType: "Order", targetId: orderId, after: { to }, reason: e.message });
    }
    throw e;
  }
}

async function transitionOrderTx(orderId: string, to: OrderStatus, actor: { id: string; canOverrideRelease?: boolean }, note?: string, overrideReason?: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { product: true } } } });
    const hasVehicle = order.items.some((i) => i.product.type === "VEHICLE");
    const installment = order.paymentMode === "INSTALLMENT";
    const paid = Number(order.amountPaid);
    const ev = evaluateRelease(paid, Number(order.releaseThreshold));
    const fullyPaid = paid >= payable(order);
    const overriding = !!(actor.canOverrideRelease && overrideReason && overrideReason.trim().length >= 10);
    try {
      assertTransition({ from: order.status, to, hasVehicle, installment, releaseEligible: ev.state === "ELIGIBLE", fullyPaid });
    } catch (e) {
      if (e instanceof ReleaseBlockedError && overriding) {
        await tx.releaseDecision.create({ data: { orderId, state: "ELIGIBLE", paid: BigInt(paid), threshold: order.releaseThreshold, overridden: true, reason: overrideReason, actorId: actor.id } });
        await audit({ actorId: actor.id, action: "release.override", targetType: "Order", targetId: orderId, before: { state: "BLOCKED", paid }, after: { to }, reason: overrideReason }, tx);
      } else throw e;
    }
    if (to === "DELIVERED" || to === "COMPLETED") {
      if (order.status !== "DELIVERED") {
        for (const it of order.items) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stockOnHand: { decrement: it.quantity }, stockReserved: { decrement: it.quantity }, stockSold: { increment: it.quantity }, ...(it.product.type === "VEHICLE" ? { status: "SOLD" as const } : {}) },
          });
          await tx.stockMovement.create({ data: { productId: it.productId, type: "SALE", quantity: it.quantity, orderId, actorId: actor.id } });
        }
      }
    }
    if (to === "CANCELLED") await releaseOrderStock(tx, orderId, actor.id, "Order cancelled");
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderStateHistory.create({ data: { orderId, fromStatus: order.status, toStatus: to, actorId: actor.id, note } });
    await audit({ actorId: actor.id, action: "order.transition", targetType: "Order", targetId: orderId, before: { status: order.status }, after: { status: to } }, tx);
    return updated;
  });
}

export async function releaseOrderStock(tx: Tx, orderId: string, actorId: string | null, reason: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    await tx.product.update({ where: { id: it.productId }, data: { stockReserved: { decrement: it.quantity } } });
    await tx.stockMovement.create({ data: { productId: it.productId, type: "RELEASE", quantity: it.quantity, orderId, reason, actorId: actorId ?? undefined } });
  }
  await tx.reservation.updateMany({ where: { orderId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
}

/** Cron: free vehicles held by unpaid reservations that have expired. */
export async function expireReservations(now = new Date()): Promise<number> {
  const expired = await db.reservation.findMany({ where: { status: "ACTIVE", expiresAt: { lt: now } } });
  let n = 0;
  for (const r of expired) {
    await db.$transaction(async (tx) => {
      const claim = await tx.reservation.updateMany({ where: { id: r.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      if (claim.count === 0) return;
      if (r.orderId) {
        const o = await tx.order.findUnique({ where: { id: r.orderId } });
        if (o && o.status === "PENDING_PAYMENT" && Number(o.amountPaid) === 0) {
          await releaseOrderStock(tx, o.id, null, "Reservation expired");
          await tx.order.update({ where: { id: o.id }, data: { status: "CANCELLED" } });
          await tx.orderStateHistory.create({ data: { orderId: o.id, fromStatus: o.status, toStatus: "CANCELLED", note: "Reservation expired" } });
        }
      }
      n++;
    });
  }
  return n;
}

/**
 * Recompute an UNPAID order with VAT forced on or off (used when a VAT exemption is approved or rejected).
 * Uses the exact inputs and settings stored at order time, so the only thing that changes is the VAT switch.
 */
export async function recalculateOrderVat(orderId: string, vatEnabled: boolean, actorId: string, reason: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (Number(order.amountPaid) > 0) throw new OrderError("VAT cannot be changed after a payment has been received.", "STATE");
    const snap = order.pricingSnapshot as unknown as { _input: PricingInput; _settings: PricingSettings };
    if (!snap?._input || !snap._settings) throw new OrderError("This order has no stored pricing inputs.", "STATE");
    const pricing = computePricing({ ...snap._input, vatEnabled }, snap._settings);
    await tx.order.update({
      where: { id: orderId },
      data: {
        vatEnabled, vatTotal: BigInt(pricing.vatTotal), grandTotal: BigInt(pricing.grandTotal), releaseThreshold: BigInt(pricing.releaseThreshold),
        vatExemptionStatus: vatEnabled ? "REJECTED" : "APPROVED",
        pricingSnapshot: JSON.parse(JSON.stringify({ ...pricing, _input: { ...snap._input, vatEnabled }, _settings: snap._settings })) as Prisma.InputJsonValue,
      },
    });
    for (let i = 0; i < order.items.length; i++) {
      await tx.orderItem.update({ where: { id: order.items[i].id }, data: { vat: BigInt(pricing.lines[i].vat), lineTotal: BigInt(pricing.lines[i].priced + pricing.lines[i].vat) } });
    }
    if (order.paymentMode === "INSTALLMENT") await tx.installmentPlan.update({ where: { orderId }, data: { thresholdKobo: BigInt(pricing.releaseThreshold) } });
    await audit({ actorId, action: vatEnabled ? "vat.exemption_rejected" : "vat.exemption_approved", targetType: "Order", targetId: orderId, before: { vatTotal: Number(order.vatTotal), grandTotal: Number(order.grandTotal) }, after: { vatTotal: pricing.vatTotal, grandTotal: pricing.grandTotal }, reason }, tx);
    return pricing;
  });
}


let lastSweep = 0;
/**
 * Releases expired vehicle holds. Called from busy paths (browsing, ordering) and throttled to once a minute per instance,
 * so holds free up on time even though the Vercel Hobby plan only allows a daily cron job.
 */
export async function sweepExpiredReservations(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  try {
    await expireReservations();
  } catch (e) {
    console.error("[sweepExpiredReservations]", e);
  }
}
