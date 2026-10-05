import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { evaluateRelease } from "@/lib/pricing/release";
import { payable } from "@/lib/services/orders";
import { TRANSITIONS } from "@/lib/orders/state";
import { transitionOrderAction, refundAction } from "@/app/actions/admin-finance";
import { PageHeader, Notice, Pill, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage("orders:view");
  const { id } = await params;
  const sp = await searchParams;
  const o = await db.order.findUnique({ where: { id }, include: { customer: true, items: true, payments: { orderBy: { createdAt: "desc" } }, history: { orderBy: { createdAt: "desc" } }, installment: true, vatRecords: true, releases: { orderBy: { createdAt: "desc" } } } });
  if (!o) notFound();
  const paid = Number(o.amountPaid);
  const rel = o.paymentMode === "INSTALLMENT" ? evaluateRelease(paid, Number(o.releaseThreshold)) : null;
  const canEdit = user.permissions.has("orders:edit");
  const canOverride = user.permissions.has("release:override");
  const nexts = TRANSITIONS[o.status];
  return (
    <>
      <PageHeader title={`Order ${o.orderNumber}`} sub={`${o.customer.name} · ${o.customer.email ?? ""} · ${o.customer.phone ?? ""}`} actions={<Link href="/admin/orders" className="btn-ghost">All orders</Link>} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="mb-4 flex flex-wrap items-center gap-2"><Pill>{o.status.replace(/_/g, " ")}</Pill>{o.paymentMode === "INSTALLMENT" && <Pill tone="gold">Installment</Pill>}{o.isDemo && <Pill tone="gold">Demo</Pill>}{o.vatExemptionStatus && <Pill tone="warn">VAT exemption: {o.vatExemptionStatus.replace(/_/g, " ")}</Pill>}</div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Table head={["Item", "SKU", "Qty", "Unit", "VAT", "Line total"]}>{o.items.map((i) => <tr key={i.id}><td className="td font-medium">{i.name}</td><td className="td font-mono text-xs">{i.sku}</td><td className="td">{i.quantity}</td><td className="td">{formatNaira(Number(i.unitPrice))}</td><td className="td">{formatNaira(Number(i.vat))}</td><td className="td">{formatNaira(Number(i.lineTotal))}</td></tr>)}</Table>

          {rel && (
            <section className={`card p-5 ${rel.state === "ELIGIBLE" ? "border-ok/40" : "border-danger/40"}`}>
              <h2 className="font-display text-lg font-bold text-navy">Vehicle release control</h2>
              <p className={`mt-2 inline-block rounded-lg px-3 py-1.5 text-sm font-extrabold tracking-wide ${rel.state === "ELIGIBLE" ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger"}`}>{rel.state === "ELIGIBLE" ? "RELEASE ELIGIBLE" : "RELEASE BLOCKED"}</p>
              <p className="mt-3 text-sm">Verified paid <strong>{formatNaira(paid)}</strong> of threshold <strong>{formatNaira(Number(o.releaseThreshold))}</strong>.{rel.shortfall > 0 && <> Shortfall <strong>{formatNaira(rel.shortfall)}</strong>.</>}</p>
              {o.installment && <p className="mt-1 text-xs text-muted">Outright {formatNaira(Number(o.installment.outrightPrice))} → installment {formatNaira(Number(o.installment.installmentPrice))} (+{o.installment.upliftBps / 100}%), threshold {o.installment.thresholdBps / 100}%.</p>}
              {o.releases.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted">{o.releases.map((r) => <li key={r.id}>{r.createdAt.toLocaleString("en-NG")}: {r.state}{r.overridden ? " (OVERRIDDEN)" : ""} {r.reason ? `- ${r.reason}` : ""}</li>)}</ul>}
            </section>
          )}

          <section><h2 className="mb-2 font-display text-lg font-bold text-navy">Payments</h2>
            <Table head={["Reference", "Method", "Expected", "Paid", "Status", ""]} empty={o.payments.length === 0 ? "No payments yet." : undefined}>
              {o.payments.map((p) => <tr key={p.id}><td className="td font-mono text-xs">{p.reference}</td><td className="td">{p.method.replace("_", " ")}</td><td className="td">{formatNaira(Number(p.expectedAmount))}</td><td className="td">{formatNaira(Number(p.paidAmount))}</td><td className="td"><Pill tone={p.status === "SUCCESS" ? "ok" : p.status === "AWAITING_VERIFICATION" ? "warn" : "info"}>{p.status.replace(/_/g, " ")}</Pill></td><td className="td"><Link href={`/admin/payments?q=${p.reference}`} className="text-sm text-brand hover:underline">Open</Link></td></tr>)}
            </Table></section>

          <section><h2 className="mb-2 font-display text-lg font-bold text-navy">History</h2>
            <ul className="card divide-y divide-line text-sm">{o.history.map((h) => <li key={h.id} className="flex justify-between gap-3 p-3"><span>{h.fromStatus ? `${h.fromStatus.replace(/_/g, " ")} → ` : ""}<strong>{h.toStatus.replace(/_/g, " ")}</strong>{h.note ? <span className="text-muted"> · {h.note}</span> : null}</span><span className="text-xs text-muted">{h.createdAt.toLocaleString("en-NG")}</span></li>)}</ul></section>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-2 p-5 text-sm"><h2 className="font-display text-lg font-bold text-navy">Totals</h2>
            <dl className="space-y-1.5">
              {([["Subtotal", o.subtotal], ["Discount", o.discountTotal], ["Installment adjustment", o.upliftTotal], [`VAT (${o.vatRateBps / 100}%)${o.vatEnabled ? "" : " - EXEMPT"}`, o.vatTotal], ["Charges", o.chargesTotal], ["Trade-in credit", o.tradeInCredit]] as [string, bigint][]).map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd>{formatNaira(Number(v))}</dd></div>)}
              <div className="flex justify-between border-t border-line pt-2 font-bold text-navy"><dt>Grand total</dt><dd>{formatNaira(Number(o.grandTotal))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Verified paid</dt><dd className="font-semibold text-ok">{formatNaira(paid)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Balance</dt><dd className="font-semibold">{formatNaira(Math.max(0, payable(o) - paid))}</dd></div>
            </dl>
            <p className="pt-1 text-xs text-muted">Delivery: {o.deliveryMethod}{o.deliveryAddress ? ` · ${o.deliveryAddress}, ${o.deliveryCity}, ${o.deliveryState}` : ""}</p>
          </section>

          {canEdit && nexts.length > 0 && (
            <form action={transitionOrderAction} className="card space-y-3 p-5">
              <h2 className="font-display text-lg font-bold text-navy">Update status</h2>
              <input type="hidden" name="orderId" value={o.id} />
              <div><label className="label" htmlFor="to">Move to</label><select id="to" name="to" className="input">{nexts.map((n) => <option key={n} value={n}>{n.replace(/_/g, " ")}</option>)}</select></div>
              <div><label className="label" htmlFor="note">Note (optional)</label><input id="note" name="note" className="input" /></div>
              {canOverride && o.paymentMode === "INSTALLMENT" && <div className="rounded-xl border border-danger/30 p-3"><label className="label" htmlFor="ov">Super Admin release override (reason, min 10 chars)</label><input id="ov" name="overrideReason" className="input" placeholder="Only if you are overriding a BLOCKED release" /><p className="mt-1 text-xs text-muted">Audited. Leave blank for a normal change.</p></div>}
              <button className="btn-primary w-full">Apply</button>
            </form>
          )}

          {user.permissions.has("payments:refund") && paid > 0 && (
            <form action={refundAction} className="card space-y-3 p-5">
              <h2 className="font-display text-lg font-bold text-navy">Record refund</h2>
              <input type="hidden" name="orderId" value={o.id} />
              <div><label className="label" htmlFor="ra">Amount (₦)</label><input id="ra" name="amountNaira" inputMode="decimal" className="input" /></div>
              <div><label className="label" htmlFor="rr">Reason</label><input id="rr" name="reason" required className="input" /></div>
              <button className="btn-danger w-full">Record refund</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
