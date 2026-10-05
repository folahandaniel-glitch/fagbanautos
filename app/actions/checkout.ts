"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCart } from "@/lib/cart";
import { getSessionUser } from "@/lib/auth/session";
import { buildQuote, createOrder, OrderError, type QuoteInput } from "@/lib/services/orders";
import { startPaystackPayment, startBankTransfer, PaymentError } from "@/lib/services/payments";
import { getPaystackConfig } from "@/lib/services/paystack";
import { rateLimit } from "@/lib/rate-limit";
import { nairaToKobo } from "@/lib/money";
import { headers } from "next/headers";

const inputSchema = z.object({
  mode: z.enum(["OUTRIGHT", "INSTALLMENT"]),
  depositNaira: z.number().min(0).max(10_000_000_000).optional(),
  deliveryMethod: z.enum(["PICKUP", "DELIVERY"]),
  delivery: z.object({ address: z.string().max(300).optional(), city: z.string().max(80).optional(), state: z.string().max(80).optional(), contact: z.string().max(40).optional() }).optional(),
  couponCode: z.string().max(40).optional(),
  vatOff: z.boolean().optional(),
  vatReason: z.string().max(400).optional(),
  paymentMethod: z.enum(["PAYSTACK", "BANK_TRANSFER"]).optional(),
  idemKey: z.string().min(8).max(80).optional(),
});
export type CheckoutInput = z.infer<typeof inputSchema>;

export interface QuoteView {
  ok: true;
  lines: { name: string; quantity: number; unitPrice: number; lineTotal: number; type: string }[];
  subtotal: number; discountTotal: number; upliftTotal: number; vatRateBps: number; vatTotal: number; vatRemovedTotal: number;
  charges: { label: string; amount: number }[]; tradeInCredit: number; grandTotal: number; amountDueNow: number; balanceAfterDueNow: number;
  releaseThreshold: number; minDeposit: number; vatOffAllowed: boolean; vatEnabled: boolean; hasVehicle: boolean; installmentEligible: boolean;
  couponApplied?: string; mode: "OUTRIGHT" | "INSTALLMENT";
}
export type QuoteResult = QuoteView | { ok: false; error: string };

async function cartLines() {
  const cart = await getCart();
  return (cart?.items ?? []).filter((i) => !i.savedForLater).map((i) => ({ productId: i.productId, quantity: i.quantity }));
}

function toQuoteInput(i: CheckoutInput, lines: { productId: string; quantity: number }[]): QuoteInput {
  return {
    lines, mode: i.mode, deposit: i.depositNaira != null ? nairaToKobo(i.depositNaira) : undefined,
    vatOffRequested: i.vatOff === true, deliveryMethod: i.deliveryMethod, couponCode: i.couponCode || undefined,
  };
}

export async function quoteAction(raw: unknown): Promise<QuoteResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid checkout details." };
  const lines = await cartLines();
  try {
    const mode0 = parsed.data;
    // quote with deposit defaulting to the minimum so the minimum is always known to the UI
    const probe = mode0.mode === "INSTALLMENT" ? await buildQuote(toQuoteInput({ ...mode0, depositNaira: 0 }, lines)) : null;
    const q = await buildQuote(toQuoteInput(mode0, lines));
    const p = q.pricing;
    // installment eligibility is a property of the cart, independent of the chosen mode
    const eligible = (await db.product.count({ where: { id: { in: lines.map((l) => l.productId) }, type: "VEHICLE", vehicle: { installmentAvailable: true } } })) > 0;
    return {
      ok: true, mode: mode0.mode,
      lines: q.lines.map((l, i) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: p.lines[i].priced + p.lines[i].vat, type: l.type })),
      subtotal: p.subtotal, discountTotal: p.discountTotal, upliftTotal: p.upliftTotal, vatRateBps: p.vatRateBps, vatTotal: p.vatTotal, vatRemovedTotal: p.vatRemovedTotal,
      charges: p.charges.map((c) => ({ label: c.label, amount: c.amount })), tradeInCredit: p.tradeInCredit, grandTotal: p.grandTotal, amountDueNow: p.amountDueNow,
      balanceAfterDueNow: p.balanceAfterDueNow, releaseThreshold: p.releaseThreshold, minDeposit: probe?.minDeposit ?? q.minDeposit, vatOffAllowed: q.vatOffAllowed,
      vatEnabled: q.vatEnabled, hasVehicle: q.hasVehicle, installmentEligible: eligible, couponApplied: q.couponApplied,
    };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message };
    console.error("[quote]", e);
    return { ok: false, error: "We could not price your order. Please try again." };
  }
}

export type PlaceResult = { ok: true; redirect: string } | { ok: false; error: string };

export async function placeOrder(raw: unknown): Promise<PlaceResult> {
  const user = await getSessionUser();
  if (!user || !user.customerId) return { ok: false, error: "Please sign in to place an order." };
  if (!(await rateLimit("place-order", 8, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid checkout details." };
  const i = parsed.data;
  if (i.idemKey) {
    const prev = await db.idempotencyKey.findUnique({ where: { key: `checkout:${user.id}:${i.idemKey}` } });
    if (prev?.response) return prev.response as PlaceResult;
  }
  if (i.deliveryMethod === "DELIVERY" && !(i.delivery?.address && i.delivery.city && i.delivery.state)) return { ok: false, error: "Please enter your delivery address, city and state." };
  const method = i.paymentMethod;
  if (!method) return { ok: false, error: "Please choose a payment method." };
  if (method === "PAYSTACK" && !(await getPaystackConfig()).enabled) return { ok: false, error: "Paystack is not enabled yet. Please choose bank transfer." };

  const lines = await cartLines();
  const h = await headers();
  try {
    const order = await createOrder({
      ...toQuoteInput(i, lines), customerId: user.customerId, actorId: user.id, delivery: i.delivery, vatOffReason: i.vatReason,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(), sessionId: user.id,
    });
    const cart = await getCart();
    if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id, savedForLater: false } });

    const due = Number(order.grandTotal) - Number(order.tradeInCredit);
    const pricing = order.pricingSnapshot as unknown as { amountDueNow: number };
    const amount = Math.max(1, Math.min(pricing.amountDueNow || due, due));
    let result: PlaceResult;
    if (order.vatExemptionStatus === "PENDING_APPROVAL") {
      result = { ok: true, redirect: `/order/${order.orderNumber}?notice=vat-approval` };
    } else if (method === "PAYSTACK") {
      try {
        result = { ok: true, redirect: await startPaystackPayment(order.id, amount, user.email) };
      } catch (err) {
        // The order exists; let the customer retry payment from the order page instead of losing it.
        console.error("[placeOrder] paystack init failed", err);
        result = { ok: true, redirect: `/order/${order.orderNumber}?notice=pay-failed` };
      }
    } else {
      const bank = await db.bankAccount.findFirst({ where: { OR: [{ isActive: true }, { isPlaceholder: true }] }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] });
      if (!bank) return { ok: true, redirect: `/order/${order.orderNumber}?notice=no-bank` };
      const pay = await startBankTransfer(order.id, amount, bank.id);
      result = { ok: true, redirect: `/order/${order.orderNumber}?pay=${pay.id}` };
    }
    if (i.idemKey) await db.idempotencyKey.create({ data: { key: `checkout:${user.id}:${i.idemKey}`, scope: "checkout", response: result } }).catch(() => undefined);
    return result;
  } catch (e) {
    if (e instanceof OrderError || e instanceof PaymentError) return { ok: false, error: e.message };
    console.error("[placeOrder]", e);
    return { ok: false, error: "We could not place your order. Please try again." };
  }
}
