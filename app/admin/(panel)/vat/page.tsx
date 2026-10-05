import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { vatDecisionAction } from "@/app/actions/admin-finance";
import { PageHeader, Table, Pill, Notice, Stat } from "@/components/admin/ui";

export const metadata: Metadata = { title: "VAT", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VatPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage("vat:view");
  const sp = await searchParams;
  const [records, collected, exempt, withVat, withoutVat, byMonth] = await Promise.all([
    db.vatRecord.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { orderNumber: true } } } }),
    db.order.aggregate({ where: { vatEnabled: true, status: { not: "CANCELLED" } }, _sum: { vatTotal: true }, _count: true }),
    db.vatRecord.aggregate({ where: { status: { in: ["APPLIED", "APPROVED"] } }, _sum: { vatRemoved: true } }),
    db.order.count({ where: { vatEnabled: true } }),
    db.order.count({ where: { vatEnabled: false } }),
    db.$queryRaw<{ m: Date; vat: bigint }[]>`SELECT date_trunc('month', "createdAt") m, SUM("vatTotal") vat FROM "Order" WHERE status <> 'CANCELLED' GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
  ]);
  const canApprove = user.permissions.has("vat:approve");
  return (
    <>
      <PageHeader title="VAT" sub="Collected, exempted, and every time VAT was switched off." actions={user.permissions.has("vat:export") ? <Link href="/admin/export/vat" className="btn-ghost">Export Excel</Link> : undefined} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="VAT collected" value={formatNaira(Number(collected._sum.vatTotal ?? 0), { whole: true })} tone="ok" />
        <Stat label="VAT exempted" value={formatNaira(Number(exempt._sum.vatRemoved ?? 0), { whole: true })} tone="warn" />
        <Stat label="Orders with VAT" value={String(withVat)} />
        <Stat label="Orders without VAT" value={String(withoutVat)} />
      </div>
      <section className="mt-6"><h2 className="mb-2 font-display text-lg font-bold text-navy">VAT by month</h2>
        <Table head={["Month", "VAT"]}>{byMonth.map((r) => <tr key={String(r.m)}><td className="td">{new Date(r.m).toLocaleString("en-NG", { month: "long", year: "numeric" })}</td><td className="td">{formatNaira(Number(r.vat), { whole: true })}</td></tr>)}</Table></section>
      <section className="mt-6"><h2 className="mb-2 font-display text-lg font-bold text-navy">VAT switch-off audit trail</h2>
        <Table head={["Date", "Order", "Removed", "Reason", "Status", ""]} empty={records.length === 0 ? "VAT has never been switched off." : undefined}>
          {records.map((r) => (
            <tr key={r.id}><td className="td text-muted">{r.createdAt.toLocaleString("en-NG")}</td><td className="td"><Link href={`/admin/orders/${r.orderId}`} className="text-brand hover:underline">{r.order.orderNumber}</Link></td><td className="td">{formatNaira(Number(r.vatRemoved))}</td><td className="td max-w-xs text-sm">{r.reason ?? "-"}{r.ip && <span className="block text-xs text-muted">IP {r.ip}</span>}</td>
              <td className="td"><Pill tone={r.status === "PENDING_APPROVAL" ? "warn" : r.status === "REJECTED" ? "danger" : "ok"}>{r.status.replace(/_/g, " ")}</Pill></td>
              <td className="td">{canApprove && r.status === "PENDING_APPROVAL" && (
                <form action={vatDecisionAction} className="flex flex-col gap-1.5"><input type="hidden" name="recordId" value={r.id} /><input name="reason" className="input !min-h-9" placeholder="Reason" /><div className="flex gap-1.5"><button name="decision" value="approve" className="btn-primary !min-h-9 !px-3">Approve</button><button name="decision" value="reject" className="btn-danger !min-h-9 !px-3">Reject</button></div></form>
              )}</td></tr>
          ))}
        </Table></section>
    </>
  );
}
