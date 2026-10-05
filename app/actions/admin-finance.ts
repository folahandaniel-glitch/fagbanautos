"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, AuthError } from "@/lib/auth/guard";
import { applyVerifiedPayment, recalculateOrderVat, releaseOrderStock, transitionOrder, OrderError, payable } from "@/lib/services/orders";
import { ReleaseBlockedError, TransitionError } from "@/lib/orders/state";
import { getSetting } from "@/lib/settings";
import { nairaToKobo } from "@/lib/money";

const ORDER_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAYMENT_VERIFICATION", "PAID", "PARTIALLY_PAID", "PROCESSING", "RESERVED", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"];

function back(path: string, kind: "notice" | "error", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
}

/** Wraps an action so auth failures surface as redirects instead of unhandled errors. */
async function guard<T>(perm: string, fn: (user: Awaited<ReturnType<typeof requirePermission>>) => Promise<T>, failPath: string): Promise<T> {
  let user;
  try { user = await requirePermission(perm); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${failPath}?error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
  return fn(user);
}

export async function transitionOrderAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const to = String(formData.get("to")) as OrderStatus;
  const path = `/admin/orders/${orderId}`;
  if (!ORDER_STATUSES.includes(to)) back(path, "error", "Invalid status.");
  await guard("orders:edit", async (user) => {
    try {
      await transitionOrder(orderId, to, { id: user.id, canOverrideRelease: user.permissions.has("release:override") }, String(formData.get("note") ?? "") || undefined, String(formData.get("overrideReason") ?? "") || undefined);
    } catch (e) {
      if (e instanceof ReleaseBlockedError) back(path, "error", `${e.message}. Only the Super Admin can override, with a written reason.`);
      if (e instanceof TransitionError || e instanceof OrderError) back(path, "error", e.message);
      throw e;
    }
  }, path);
  revalidatePath(path);
  back(path, "notice", `Order moved to ${to.replace(/_/g, " ")}.`);
}

export async function verifyPaymentAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId"));
  const decision = String(formData.get("decision"));
  const reason = String(formData.get("reason") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin/payments");
  const path = returnTo.startsWith("/admin") ? returnTo : "/admin/payments";
  const perm = decision === "approve" ? "payments:verify" : decision === "override_approve" || decision === "override_reject" ? "payments:override" : decision === "reject" ? "payments:reject" : "payments:verify";
  await guard(perm, async (user) => {
    const p = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!p) back(path, "error", "Payment not found.");
    if (p.method === "PAYSTACK" && decision !== "override_approve" && decision !== "override_reject") back(path, "error", "Paystack payments are verified automatically by the server.");
    if (decision === "approve") {
      if (p.status !== "AWAITING_VERIFICATION") back(path, "error", "This payment is not awaiting verification.");
      const received = nairaToKobo(Number(String(formData.get("receivedNaira") ?? "").replace(/[^\d.]/g, "")) || Number(p.expectedAmount) / 100);
      if (received <= 0 || received > payable(p.order) * 2) back(path, "error", "Enter the amount actually received.");
      const threshold = nairaToKobo(Number(await getSetting<number>("payments.twoPersonApprovalAboveNaira")));
      const raw = (p.rawEvent ?? {}) as { firstApprover?: string };
      if (received >= threshold && !user.permissions.has("payments:override")) {
        if (!raw.firstApprover) {
          await db.payment.update({ where: { id: p.id }, data: { rawEvent: { ...raw, firstApprover: user.id, firstApprovedAt: new Date().toISOString(), receivedKobo: received } } });
          await audit({ actorId: user.id, action: "payment.first_approval", targetType: "Payment", targetId: p.id, after: { received } });
          back(path, "notice", "First approval recorded. A second finance approver must confirm this high-value payment.");
        }
        if (raw.firstApprover === user.id) back(path, "error", "A different approver must give the second approval.");
      }
      const reconciled = await applyVerifiedPayment({ paymentId: p.id, paidAmount: received, actorId: user.id, note: "Bank transfer verified" });
      void reconciled;
    } else if (decision === "reject" || decision === "clarify") {
      if (reason.length < 5) back(path, "error", "Please give a reason the customer can read.");
      if (!["AWAITING_VERIFICATION", "INITIATED"].includes(p.status)) back(path, "error", "This payment cannot be changed.");
      await db.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: p.id }, data: { status: decision === "reject" ? "REJECTED" : "CLARIFICATION_REQUESTED", rejectionReason: reason, verifiedById: user.id, verifiedAt: new Date() } });
        await audit({ actorId: user.id, action: decision === "reject" ? "payment.reject" : "payment.request_clarification", targetType: "Payment", targetId: p.id, reason }, tx);
        await tx.notification.create({ data: { userId: (await tx.customer.findUnique({ where: { id: p.order.customerId } }))?.userId ?? undefined, event: "payment.update", title: decision === "reject" ? "Payment proof rejected" : "More information needed", body: reason } });
      });
    } else if (decision === "override_approve") {
      if (reason.length < 10) back(path, "error", "A written reason of at least 10 characters is required for an override.");
      const amount = nairaToKobo(Number(String(formData.get("receivedNaira") ?? "").replace(/[^\d.]/g, "")) || Number(p.expectedAmount) / 100);
      await audit({ actorId: user.id, action: "payment.override_approve", targetType: "Payment", targetId: p.id, before: { status: p.status }, after: { amount }, reason });
      await applyVerifiedPayment({ paymentId: p.id, paidAmount: amount, actorId: user.id, note: `Super Admin override: ${reason}` });
    } else if (decision === "override_reject") {
      if (reason.length < 10) back(path, "error", "A written reason of at least 10 characters is required for an override.");
      if (p.status === "SUCCESS") back(path, "error", "Use a refund to reverse a verified payment.");
      await db.payment.update({ where: { id: p.id }, data: { status: "REJECTED", rejectionReason: reason, verifiedById: user.id, verifiedAt: new Date() } });
      await audit({ actorId: user.id, action: "payment.override_reject", targetType: "Payment", targetId: p.id, before: { status: p.status }, reason });
    } else back(path, "error", "Unknown decision.");
  }, path);
  revalidatePath("/admin/payments");
  back(path, "notice", "Payment updated.");
}

export async function refundAction(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const path = `/admin/orders/${orderId}`;
  const reason = String(formData.get("reason") ?? "").trim();
  const amount = nairaToKobo(Number(String(formData.get("amountNaira") ?? "").replace(/[^\d.]/g, "")));
  await guard("payments:refund", async (user) => {
    if (reason.length < 10) back(path, "error", "A written reason (at least 10 characters) is required.");
    if (!Number.isSafeInteger(amount) || amount <= 0) back(path, "error", "Enter a valid refund amount.");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (amount > Number(o.amountPaid)) back(path, "error", "Refund exceeds the amount paid.");
      await tx.ledgerEntry.create({ data: { orderId, type: "REFUND", amount: BigInt(-amount), note: reason, actorId: user.id } });
      const paid = Number(o.amountPaid) - amount;
      const full = paid === 0;
      await tx.order.update({ where: { id: orderId }, data: { amountPaid: BigInt(paid), ...(full ? { status: "REFUNDED" as const } : {}) } });
      if (full) {
        await tx.orderStateHistory.create({ data: { orderId, fromStatus: o.status, toStatus: "REFUNDED", actorId: user.id, note: reason } });
        await releaseOrderStock(tx, orderId, user.id, "Order refunded");
      }
      await audit({ actorId: user.id, action: "payment.refund", targetType: "Order", targetId: orderId, after: { amount, paid }, reason }, tx);
    });
  }, path);
  revalidatePath(path);
  back(path, "notice", "Refund recorded.");
}

export async function vatDecisionAction(formData: FormData) {
  const recordId = String(formData.get("recordId"));
  const decision = String(formData.get("decision"));
  const reason = String(formData.get("reason") ?? "").trim() || "Decision recorded";
  const path = "/admin/vat";
  await guard("vat:approve", async (user) => {
    const rec = await db.vatRecord.findUnique({ where: { id: recordId } });
    if (!rec || rec.status !== "PENDING_APPROVAL") back(path, "error", "This request is not pending.");
    try {
      await recalculateOrderVat(rec.orderId, decision !== "approve", user.id, reason);
    } catch (e) {
      if (e instanceof OrderError) back(path, "error", e.message);
      throw e;
    }
    await db.vatRecord.update({ where: { id: recordId }, data: { status: decision === "approve" ? "APPROVED" : "REJECTED", approverId: user.id } });
  }, path);
  revalidatePath(path);
  back(path, "notice", decision === "approve" ? "VAT exemption approved. The customer can now pay the VAT-free total." : "VAT exemption rejected. VAT has been restored on the order.");
}
