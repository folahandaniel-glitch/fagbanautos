import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { processPaystackReference, type ProcessResult } from "@/lib/services/paystack";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };
export const dynamic = "force-dynamic";

const COPY: Record<ProcessResult, { title: string; body: string; tone: string }> = {
  credited: { title: "Payment confirmed", body: "Thank you. We have verified your payment with Paystack.", tone: "text-ok" },
  duplicate: { title: "Payment confirmed", body: "This payment has already been recorded.", tone: "text-ok" },
  pending: { title: "Payment is processing", body: "Your bank has not confirmed the payment yet. This page does not mean it failed. We will update your order as soon as it is confirmed.", tone: "text-warn" },
  failed: { title: "Payment was not completed", body: "No money was taken, or it was reversed. You can try again from your order page.", tone: "text-danger" },
  mismatch: { title: "We need to review this payment", body: "The amount received did not match the order. Our finance team has been alerted and will contact you.", tone: "text-danger" },
  unknown: { title: "Payment not found", body: "We could not find this payment reference.", tone: "text-danger" },
};

/** The browser callback is NOT proof of payment: we always re-verify with Paystack on the server. */
export default async function PaystackCallback({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref;
  let result: ProcessResult = "unknown";
  let orderNumber: string | null = null;
  if (reference) {
    try { result = await processPaystackReference(reference); } catch (e) { console.error("[paystack callback]", e); result = "pending"; }
    const p = await db.payment.findUnique({ where: { reference }, include: { order: { select: { orderNumber: true } } } });
    orderNumber = p?.order.orderNumber ?? null;
  }
  const c = COPY[result];
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-12">
      <div className="card max-w-lg p-8 text-center">
        <h1 className={`font-display text-2xl font-extrabold ${c.tone}`}>{c.title}</h1>
        <p className="mt-3 text-sm text-muted">{c.body}</p>
        {orderNumber && <Link href={`/order/${orderNumber}`} className="btn-primary mt-6">View order {orderNumber}</Link>}
      </div>
    </div>
  );
}
