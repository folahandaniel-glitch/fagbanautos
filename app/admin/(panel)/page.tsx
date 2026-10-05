import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { dashboardStats } from "@/lib/services/reports";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { PageHeader, Stat, Notice, BarChart, Pill, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Command centre", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireStaffPage();
  const sp = await searchParams;
  const canReports = user.permissions.has("reports:view") || user.permissions.has("payments:view");
  const [s, recent, tasks] = await Promise.all([
    canReports ? dashboardStats() : null,
    user.permissions.has("orders:view") ? db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { customer: { select: { name: true } } } }) : [],
    user.permissions.has("tasks:view") ? db.task.findMany({ where: { status: "OPEN", assigneeId: user.id }, orderBy: { deadline: "asc" }, take: 5 }) : [],
  ]);
  return (
    <>
      <PageHeader title="Command centre" sub={`Welcome back, ${user.name}.`} />
      {sp.denied && <Notice kind="error">You do not have permission to open that page.</Notice>}
      {s ? (
        <>
          {(s.pendingProofs > 0 || s.vatPending > 0 || s.lowStock > 0) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {s.pendingProofs > 0 && <Link href="/admin/payments?status=AWAITING_VERIFICATION" className="pill"><Pill tone="warn">{s.pendingProofs} payment{s.pendingProofs > 1 ? "s" : ""} awaiting verification</Pill></Link>}
              {s.vatPending > 0 && <Link href="/admin/vat"><Pill tone="warn">{s.vatPending} VAT exemption{s.vatPending > 1 ? "s" : ""} to approve</Pill></Link>}
              {s.lowStock > 0 && <Link href="/admin/inventory?stock=low"><Pill tone="danger">{s.lowStock} low-stock product{s.lowStock > 1 ? "s" : ""}</Pill></Link>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Revenue (verified)" value={formatNaira(s.revenue, { whole: true })} tone="ok" />
            <Stat label="Orders" value={String(s.orders)} />
            <Stat label="Vehicles sold / in progress" value={String(s.vehiclesSold)} sub={`${s.activeVehicles} vehicles available`} />
            <Stat label="Products sold" value={String(s.productsSold)} />
            <Stat label="Services booked" value={String(s.bookings)} />
            <Stat label="Installment balance" value={formatNaira(s.installmentBalance, { whole: true })} tone="warn" />
            <Stat label="VAT collected" value={formatNaira(s.vatCollected, { whole: true })} />
            <Stat label="VAT exempted" value={formatNaira(s.vatExempted, { whole: true })} sub="VAT switched off at checkout" />
            <Stat label="Inventory value" value={formatNaira(s.inventoryValue, { whole: true })} sub="List price of available stock" />
            <Stat label="Customers" value={String(s.customers)} />
            <Stat label="Leads" value={String(s.leads)} />
            <Stat label="Conversion rate" value={`${s.conversion}%`} sub="Leads won" />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Verified revenue, last 6 months</h2><div className="mt-3"><BarChart data={s.byMonth} format={(n) => formatNaira(n, { whole: true })} label="Verified revenue by month" /></div></section>
            <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Orders by status</h2>
              <ul className="mt-3 space-y-2">{s.statusGroups.length === 0 ? <li className="text-sm text-muted">No orders yet.</li> : s.statusGroups.map((g) => { const max = Math.max(...s.statusGroups.map((x) => x.count)); return <li key={g.status} className="text-sm"><div className="flex justify-between"><span>{g.status.replace(/_/g, " ")}</span><span className="font-semibold">{g.count}</span></div><div className="mt-1 h-2 rounded-full bg-brand-50"><div className="h-full rounded-full bg-brand" style={{ width: `${(g.count / max) * 100}%` }} /></div></li>; })}</ul></section>
          </div>
        </>
      ) : <Notice>Your role does not include financial dashboards. Use the menu to open your workspace.</Notice>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {recent.length > 0 && (
          <section><h2 className="mb-2 font-display text-lg font-bold text-navy">Recent orders</h2>
            <Table head={["Order", "Customer", "Total", "Status"]}>{recent.map((o) => <tr key={o.id}><td className="td"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand hover:underline">{o.orderNumber}</Link></td><td className="td">{o.customer.name}</td><td className="td">{formatNaira(Number(o.grandTotal), { whole: true })}</td><td className="td"><Pill>{o.status.replace(/_/g, " ")}</Pill></td></tr>)}</Table></section>
        )}
        {tasks.length > 0 && (
          <section><h2 className="mb-2 font-display text-lg font-bold text-navy">My open tasks</h2>
            <ul className="card divide-y divide-line">{tasks.map((t) => <li key={t.id} className="flex items-center justify-between p-3 text-sm"><span>{t.title}</span><Pill tone={t.priority === "HIGH" ? "danger" : "info"}>{t.priority}</Pill></li>)}</ul></section>
        )}
      </div>
    </>
  );
}
