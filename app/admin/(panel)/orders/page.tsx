import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { PageHeader, Table, Pill } from "@/components/admin/ui";
import { Pager } from "@/components/ui/Pager";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };
export const dynamic = "force-dynamic";
const STATUSES = ["PENDING_PAYMENT", "PAYMENT_VERIFICATION", "PARTIALLY_PAID", "PAID", "PROCESSING", "RESERVED", "READY_FOR_COLLECTION", "READY_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED", "REFUNDED"];
const PAGE = 20;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; mode?: string }> }) {
  await requireStaffPage("orders:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(sp.status && STATUSES.includes(sp.status) ? { status: sp.status as OrderStatus } : {}),
    ...(sp.mode === "INSTALLMENT" ? { paymentMode: "INSTALLMENT" } : {}),
    ...(sp.q ? { OR: [{ orderNumber: { contains: sp.q, mode: "insensitive" } }, { customer: { name: { contains: sp.q, mode: "insensitive" } } }, { customer: { email: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [orders, total] = await Promise.all([db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { customer: { select: { name: true } } } }), db.order.count({ where })]);
  return (
    <>
      <PageHeader title="Orders" sub={`${total} orders`} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Order no., name or email" /></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
        <div><label className="label" htmlFor="mode">Type</label><select id="mode" name="mode" defaultValue={sp.mode ?? ""} className="input"><option value="">All</option><option value="INSTALLMENT">Installment</option></select></div>
        <button className="btn-primary">Filter</button>
      </form>
      <Table head={["Order", "Customer", "Total", "Paid", "Status", "Release", "Date"]} empty={orders.length === 0 ? "No orders found." : undefined}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="td"><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand hover:underline">{o.orderNumber}</Link>{o.isDemo && <span className="ml-2"><Pill tone="gold">demo</Pill></span>}</td>
            <td className="td">{o.customer.name}</td><td className="td">{formatNaira(Number(o.grandTotal), { whole: true })}</td><td className="td">{formatNaira(Number(o.amountPaid), { whole: true })}</td>
            <td className="td"><Pill>{o.status.replace(/_/g, " ")}</Pill></td>
            <td className="td">{o.paymentMode === "INSTALLMENT" ? <Pill tone={o.releaseState === "ELIGIBLE" ? "ok" : "danger"}>{o.releaseState === "ELIGIBLE" ? "ELIGIBLE" : "BLOCKED"}</Pill> : <span className="text-muted">n/a</span>}</td>
            <td className="td text-muted">{o.createdAt.toLocaleDateString("en-NG")}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} basePath="/admin/orders" params={{ q: sp.q, status: sp.status, mode: sp.mode }} />
    </>
  );
}
