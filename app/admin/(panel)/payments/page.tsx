import type { Metadata } from "next";
import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { verifyPaymentAction } from "@/app/actions/admin-finance";
import { PageHeader, Pill, Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Payments", robots: { index: false } };
export const dynamic = "force-dynamic";
const STATUSES = ["INITIATED", "PENDING", "AWAITING_VERIFICATION", "CLARIFICATION_REQUESTED", "SUCCESS", "FAILED", "REJECTED", "REVERSED"];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffPage("payments:view");
  const sp = await searchParams;
  const where: Prisma.PaymentWhereInput = {
    ...(sp.status && STATUSES.includes(sp.status) ? { status: sp.status as PaymentStatus } : {}),
    ...(sp.q ? { OR: [{ reference: { contains: sp.q, mode: "insensitive" } }, { gatewayReference: { contains: sp.q, mode: "insensitive" } }, { order: { orderNumber: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const payments = await db.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, include: { order: { include: { customer: { select: { name: true } } } } } });
  const canVerify = user.permissions.has("payments:verify");
  const canOverride = user.permissions.has("payments:override");
  const totals = await db.payment.groupBy({ by: ["status"], _count: true, _sum: { expectedAmount: true, paidAmount: true } });
  const here = `/admin/payments${sp.status ? `?status=${sp.status}` : ""}`;
  return (
    <>
      <PageHeader title="Payments and reconciliation" sub="Verify bank transfers, reconcile gateway payments, and review every naira in and out." actions={user.permissions.has("payments:export") ? <Link href="/admin/export/payments" className="btn-ghost">Export Excel</Link> : undefined} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="mb-4 flex flex-wrap gap-2">{totals.map((t) => <Link key={t.status} href={`/admin/payments?status=${t.status}`}><Pill tone={t.status === "SUCCESS" ? "ok" : t.status === "AWAITING_VERIFICATION" ? "warn" : "info"}>{t.status.replace(/_/g, " ")}: {t._count}</Pill></Link>)}</div>
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label" htmlFor="q">Reference or order</label><input id="q" name="q" defaultValue={sp.q} className="input" /></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
        <button className="btn-primary">Filter</button>
      </form>
      <div className="space-y-3">
        {payments.length === 0 && <p className="card p-6 text-center text-sm text-muted">No payments match.</p>}
        {payments.map((p) => {
          const mismatch = p.status === "SUCCESS" && p.paidAmount !== p.expectedAmount;
          return (
            <article key={p.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-mono text-xs text-muted">{p.reference}</p><p className="mt-0.5 font-semibold text-navy"><Link href={`/admin/orders/${p.orderId}`} className="hover:underline">{p.order.orderNumber}</Link> · {p.order.customer.name}</p>
                  <p className="text-sm text-muted">{p.method === "PAYSTACK" ? "Paystack" : "Bank transfer"} · {p.createdAt.toLocaleString("en-NG")}{p.channel ? ` · ${p.channel}` : ""}</p></div>
                <div className="text-right"><p className="text-xs text-muted">Expected {formatNaira(Number(p.expectedAmount))}</p><p className="font-display text-lg font-bold text-navy">{p.status === "SUCCESS" ? formatNaira(Number(p.paidAmount)) : "-"}</p><Pill tone={p.status === "SUCCESS" ? "ok" : p.status === "AWAITING_VERIFICATION" ? "warn" : p.status === "FAILED" || p.status === "REJECTED" ? "danger" : "info"}>{p.status.replace(/_/g, " ")}</Pill>{mismatch && <p className="mt-1 text-xs font-semibold text-danger">Amount mismatch</p>}</div>
              </div>
              {p.rejectionReason && <p className="mt-2 text-xs text-danger">Note: {p.rejectionReason}</p>}
              {p.proofUrl && <p className="mt-2 text-sm"><a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">View proof of payment</a></p>}
              {canVerify && p.method === "BANK_TRANSFER" && p.status === "AWAITING_VERIFICATION" && (
                <form action={verifyPaymentAction} className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="returnTo" value={here} />
                  <div><label className="label" htmlFor={`rec-${p.id}`}>Amount received (₦)</label><input id={`rec-${p.id}`} name="receivedNaira" defaultValue={Number(p.expectedAmount) / 100} className="input" inputMode="decimal" /></div>
                  <div><label className="label" htmlFor={`rs-${p.id}`}>Reason (needed to reject or query)</label><input id={`rs-${p.id}`} name="reason" className="input" /></div>
                  <div className="flex items-end gap-2"><button name="decision" value="approve" className="btn-primary">Approve</button><button name="decision" value="clarify" className="btn-ghost">Query</button><button name="decision" value="reject" className="btn-danger">Reject</button></div>
                </form>
              )}
              {canOverride && !["SUCCESS", "REVERSED"].includes(p.status) && (
                <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-semibold text-danger">Super Admin override</summary>
                  <form action={verifyPaymentAction} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="returnTo" value={here} />
                    <div><label className="label" htmlFor={`ov-a-${p.id}`}>Amount (₦)</label><input id={`ov-a-${p.id}`} name="receivedNaira" defaultValue={Number(p.expectedAmount) / 100} className="input" /></div>
                    <div><label className="label" htmlFor={`ov-r-${p.id}`}>Mandatory reason (audited)</label><input id={`ov-r-${p.id}`} name="reason" required minLength={10} className="input" /></div>
                    <div className="flex items-end gap-2"><button name="decision" value="override_approve" className="btn-danger">Force approve</button><button name="decision" value="override_reject" className="btn-ghost">Force reject</button></div>
                  </form></details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
