import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { payable } from "@/lib/services/orders";
import { evaluateRelease } from "@/lib/pricing/release";
import { getPaystackConfig } from "@/lib/services/paystack";
import { getSettings } from "@/lib/settings";
import { payMore, uploadProof } from "@/app/actions/orders";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "vat-approval": "Your VAT exemption request is awaiting approval by our finance team. You will be able to pay as soon as it is approved.",
  "no-bank": "No bank account is available yet. Please contact us on WhatsApp to arrange payment.",
  "pay-failed": "We could not start the online payment. Your order is saved. Please try again below.",
  "proof-received": "Thank you. We received your proof of payment and our finance team will verify it shortly.",
  rate: "Too many attempts. Please wait a few minutes.",
};
const STATUS: Record<string, string> = { PENDING_PAYMENT: "Pending payment", PAYMENT_VERIFICATION: "Payment verification", PAID: "Paid", PARTIALLY_PAID: "Partially paid", PROCESSING: "Processing", RESERVED: "Reserved", READY_FOR_COLLECTION: "Ready for collection", READY_FOR_DELIVERY: "Ready for delivery", DELIVERED: "Delivered", COMPLETED: "Completed", CANCELLED: "Cancelled", REFUNDED: "Refunded" };
const PAYSTATUS: Record<string, string> = { INITIATED: "Awaiting payment", PENDING: "Processing", AWAITING_VERIFICATION: "Awaiting verification", CLARIFICATION_REQUESTED: "More information needed", SUCCESS: "Verified", FAILED: "Failed", REJECTED: "Rejected", REVERSED: "Reversed" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ notice?: string; error?: string; pay?: string }> }) {
  const { number } = await params;
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(`/order/${number}`)}`);
  const order = await db.order.findUnique({ where: { orderNumber: number }, include: { items: true, payments: { orderBy: { createdAt: "desc" } }, installment: true, reservations: { select: { id: true } } } });
  if (!order) notFound();
  const staffView = user.kind === "STAFF" && user.permissions.has("orders:view");
  if (!staffView && order.customerId !== user.customerId) notFound();

  const paid = Number(order.amountPaid);
  const owed = payable(order);
  const remaining = Math.max(0, owed - paid);
  const isInst = order.paymentMode === "INSTALLMENT";
  const rel = isInst ? evaluateRelease(paid, Number(order.releaseThreshold)) : null;
  const pct = owed > 0 ? Math.min(100, Math.floor((paid / owed) * 100)) : 0;
  const active = sp.pay ? order.payments.find((p) => p.id === sp.pay) : undefined;
  const bank = active?.bankAccountId ? await db.bankAccount.findUnique({ where: { id: active.bankAccountId } }) : null;
  const otherBanks = bank ? await db.bankAccount.findMany({ where: { isActive: true, id: { not: bank.id } }, orderBy: { sortOrder: "asc" } }) : [];
  const [pay, s] = await Promise.all([getPaystackConfig(), getSettings()]);
  const canPay = remaining > 0 && !["CANCELLED", "REFUNDED"].includes(order.status) && order.vatExemptionStatus !== "PENDING_APPROVAL" && order.customerId === user.customerId;
  const suggested = Math.ceil(Math.min(remaining, Number(order.pricingSnapshot && (order.pricingSnapshot as { amountDueNow?: number }).amountDueNow ? (order.pricingSnapshot as { amountDueNow: number }).amountDueNow : remaining)) / 100);

  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/account" className="hover:text-brand">My account</Link> / <span className="text-ink">{order.orderNumber}</span></nav>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-3xl font-extrabold text-navy">Order {order.orderNumber}</h1><span className="chip">{STATUS[order.status]}</span>{isInst && <span className="badge-gold">Installment</span>}{order.isDemo && <span className="badge-gold">Demo</span>}</div>
      <p className="mt-1 text-sm text-muted">Placed {order.createdAt.toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}</p>
      {sp.notice && NOTICES[sp.notice] && <p role="status" className="mt-4 rounded-xl bg-brand-50 p-3 text-sm">{NOTICES[sp.notice]}</p>}
      {sp.error && <p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">{sp.error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Items</h2>
            <ul className="mt-2 divide-y divide-line">{order.items.map((i) => <li key={i.id} className="flex justify-between gap-4 py-3 text-sm"><span><span className="font-semibold text-navy">{i.name}</span><span className="block text-muted">SKU {i.sku} · Qty {i.quantity}</span></span><span className="font-semibold">{formatNaira(Number(i.lineTotal))}</span></li>)}</ul></section>

          {rel && (
            <section className={`card p-5 ${rel.state === "ELIGIBLE" ? "border-ok/40" : "border-danger/30"}`} aria-labelledby="rel-h">
              <h2 id="rel-h" className="font-display text-lg font-bold text-navy">Vehicle release</h2>
              <p className={`mt-2 inline-block rounded-lg px-3 py-1.5 text-sm font-extrabold tracking-wide ${rel.state === "ELIGIBLE" ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger"}`}>{rel.state === "ELIGIBLE" ? "RELEASE ELIGIBLE" : "RELEASE BLOCKED"}</p>
              <p className="mt-3 text-sm text-muted">Paid and verified <strong>{formatNaira(paid)}</strong> of the <strong>{formatNaira(Number(order.releaseThreshold))}</strong> required for release.{rel.shortfall > 0 && <> {formatNaira(rel.shortfall)} more is needed.</>}</p>
            </section>
          )}

          <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Payments</h2>
            {order.payments.length === 0 ? <p className="mt-2 text-sm text-muted">No payments yet.</p> : (
              <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="th">Reference</th><th className="th">Method</th><th className="th">Amount</th><th className="th">Status</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-line">{order.payments.map((p) => (
                  <tr key={p.id}><td className="td font-mono text-xs">{p.reference}</td><td className="td">{p.method === "PAYSTACK" ? "Paystack" : "Bank transfer"}</td><td className="td">{formatNaira(Number(p.status === "SUCCESS" ? p.paidAmount : p.expectedAmount))}</td><td className="td"><span className="chip">{PAYSTATUS[p.status]}</span>{p.rejectionReason && <span className="block text-xs text-danger">{p.rejectionReason}</span>}</td>
                    <td className="td">{p.method === "BANK_TRANSFER" && ["INITIATED", "CLARIFICATION_REQUESTED", "REJECTED"].includes(p.status) && order.customerId === user.customerId && <Link href={`/order/${order.orderNumber}?pay=${p.id}`} className="text-sm font-semibold text-brand hover:underline">Upload proof</Link>}</td></tr>
                ))}</tbody></table></div>
            )}
          </section>

          {active && active.method === "BANK_TRANSFER" && bank && ["INITIATED", "CLARIFICATION_REQUESTED", "REJECTED"].includes(active.status) && (
            <section className="card border-brand/30 p-5" aria-labelledby="bank-h">
              <h2 id="bank-h" className="font-display text-lg font-bold text-navy">Pay by bank transfer</h2>
              {bank.isPlaceholder && <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-sm font-semibold text-danger">DEMO ACCOUNT: these are placeholder details. Do not send money. The business will enter its real bank account before going live.</p>}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Bank</dt><dd className="font-semibold">{bank.bankName}</dd></div>
                <div><dt className="text-muted">Account name</dt><dd className="font-semibold">{bank.accountName}</dd></div>
                <div><dt className="text-muted">Account number</dt><dd className="font-mono text-lg font-bold text-navy">{bank.accountNumber}</dd></div>
                <div><dt className="text-muted">Amount payable</dt><dd className="text-lg font-bold text-navy">{formatNaira(Number(active.expectedAmount))}</dd></div>
                <div><dt className="text-muted">Payment reference (use as narration)</dt><dd className="font-mono font-semibold">{active.reference}</dd></div>
                <div><dt className="text-muted">Order number</dt><dd className="font-semibold">{order.orderNumber}</dd></div>
              </dl>
              {bank.instructions && <p className="mt-3 text-sm text-muted">{bank.instructions}</p>}
              {otherBanks.length > 0 && (
                <div className="mt-4 rounded-xl bg-canvas p-3 text-sm"><p className="font-semibold text-navy">You may instead pay into any of these FAGDAN accounts (use the same reference):</p>
                  <ul className="mt-2 space-y-1">{otherBanks.map((b) => <li key={b.id}>{b.bankName}: <span className="font-mono font-semibold">{b.accountNumber}</span> · {b.accountName}</li>)}</ul></div>
              )}
              <form action={uploadProof} className="mt-5 space-y-3" encType="multipart/form-data">
                <input type="hidden" name="paymentId" value={active.id} />
                <div><label className="label" htmlFor="proof">Upload proof of payment (JPG, PNG, WebP or PDF, max 4 MB)</label><input id="proof" name="proof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="input !py-2" /></div>
                <button className="btn-primary">Submit proof</button>
              </form>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card space-y-2 p-5 text-sm"><h2 className="font-display text-lg font-bold text-navy">Summary</h2>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatNaira(Number(order.subtotal))}</dd></div>
              {Number(order.discountTotal) > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="text-ok">−{formatNaira(Number(order.discountTotal))}</dd></div>}
              {Number(order.upliftTotal) > 0 && <div className="flex justify-between"><dt className="text-muted">Installment adjustment</dt><dd>{formatNaira(Number(order.upliftTotal))}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">VAT ({order.vatRateBps / 100}%)</dt><dd>{order.vatEnabled ? formatNaira(Number(order.vatTotal)) : "₦0 (exempt)"}</dd></div>
              {Number(order.chargesTotal) > 0 && <div className="flex justify-between"><dt className="text-muted">Delivery and charges</dt><dd>{formatNaira(Number(order.chargesTotal))}</dd></div>}
              {Number(order.tradeInCredit) > 0 && <div className="flex justify-between"><dt className="text-muted">Trade-in credit</dt><dd className="text-ok">−{formatNaira(Number(order.tradeInCredit))}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-navy"><dt>Grand total</dt><dd>{formatNaira(Number(order.grandTotal))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Paid (verified)</dt><dd className="font-semibold text-ok">{formatNaira(paid)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Balance</dt><dd className="font-semibold">{formatNaira(remaining)}</dd></div>
            </dl>
            <div className="h-2 rounded-full bg-brand-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Payment progress"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
          </section>

          <section className="card space-y-2 p-5 text-sm" aria-labelledby="docs-h">
            <h2 id="docs-h" className="font-display text-lg font-bold text-navy">Documents</h2>
            <ul className="space-y-1.5 font-medium text-brand">
              <li><a className="hover:underline" href={`/api/documents/invoice/${order.orderNumber}`} target="_blank" rel="noopener">Invoice (PDF)</a></li>
              <li><a className="hover:underline" href={`/api/documents/quotation/${order.orderNumber}`} target="_blank" rel="noopener">Quotation (PDF)</a></li>
              <li><a className="hover:underline" href={`/api/documents/statement/${order.orderNumber}`} target="_blank" rel="noopener">Payment statement (PDF)</a></li>
              {isInst && <li><a className="hover:underline" href={`/api/documents/installment/${order.orderNumber}`} target="_blank" rel="noopener">Installment statement (PDF)</a></li>}
              {order.items.length > 0 && order.reservations.length > 0 && <li><a className="hover:underline" href={`/api/documents/reservation/${order.orderNumber}`} target="_blank" rel="noopener">Reservation confirmation (PDF)</a></li>}
              {order.payments.filter((p) => p.status === "SUCCESS").map((p) => <li key={p.id}><a className="hover:underline" href={`/api/documents/receipt/${p.id}`} target="_blank" rel="noopener">Receipt {p.reference} (PDF)</a></li>)}
            </ul>
          </section>

          {canPay && (
            <form action={payMore} className="card space-y-3 p-5">
              <h2 className="font-display text-lg font-bold text-navy">Make a payment</h2>
              <input type="hidden" name="orderId" value={order.id} />
              <div><label className="label" htmlFor="amt">Amount (₦)</label><input id="amt" name="amountNaira" inputMode="decimal" defaultValue={suggested} className="input" /><p className="mt-1 text-xs text-muted">Balance: {formatNaira(remaining)}</p></div>
              <div className="grid gap-2">
                {pay.enabled && <button name="method" value="PAYSTACK" className="btn-primary">Pay with Paystack</button>}
                {s["payments.bankTransferEnabled"] === true && <button name="method" value="BANK_TRANSFER" className="btn-ghost">Pay by bank transfer</button>}
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
