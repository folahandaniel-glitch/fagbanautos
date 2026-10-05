import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { PageHeader, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Global search", robots: { index: false } };
export const dynamic = "force-dynamic";

function Group({ title, children, n }: { title: string; children: React.ReactNode; n: number }) {
  if (n === 0) return null;
  return <section className="card p-4"><h2 className="mb-2 font-display text-base font-bold text-navy">{title}</h2><ul className="divide-y divide-line text-sm">{children}</ul></section>;
}

/** One search across the business. Each group is only queried (and shown) if the staff member holds that permission. */
export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireStaffPage();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const can = (p: string) => user.permissions.has(p);
  const ci = { contains: q, mode: "insensitive" as const };
  const empty: never[] = [];
  const [customers, vehicles, orders, payments, products, admins, leads, tasks, bookings, tradeins, finance] = q ? await Promise.all([
    can("customers:view") ? db.customer.findMany({ where: { OR: [{ name: ci }, { email: ci }, { phone: ci }] }, take: 6 }) : empty,
    can("vehicles:view") ? db.product.findMany({ where: { type: "VEHICLE", OR: [{ name: ci }, { sku: ci }, { vehicle: { vin: ci } }, { vehicle: { stockNumber: ci } }, { vehicle: { inventoryId: ci } }] }, take: 6, include: { vehicle: true } }) : empty,
    can("orders:view") ? db.order.findMany({ where: { OR: [{ orderNumber: ci }, { customer: { name: ci } }] }, take: 6, include: { customer: { select: { name: true } } } }) : empty,
    can("payments:view") ? db.payment.findMany({ where: { OR: [{ reference: ci }, { gatewayReference: ci }] }, take: 6, include: { order: { select: { orderNumber: true } } } }) : empty,
    can("products:view") ? db.product.findMany({ where: { type: { not: "VEHICLE" }, OR: [{ name: ci }, { sku: ci }, { partNumber: ci }] }, take: 6 }) : empty,
    can("users:view") ? db.user.findMany({ where: { kind: "STAFF", OR: [{ name: ci }, { email: ci }] }, take: 6, include: { role: true } }) : empty,
    can("leads:view") ? db.lead.findMany({ where: { OR: [{ name: ci }, { phone: ci }, { interest: ci }] }, take: 6 }) : empty,
    can("tasks:view") ? db.task.findMany({ where: { OR: [{ title: ci }, { description: ci }] }, take: 6 }) : empty,
    can("bookings:view") ? db.serviceBooking.findMany({ where: { OR: [{ vehicleInfo: ci }, { customer: { name: ci } }] }, take: 6, include: { service: true, customer: true } }) : empty,
    can("tradeins:view") ? db.tradeIn.findMany({ where: { OR: [{ make: ci }, { model: ci }, { customer: { name: ci } }] }, take: 6, include: { customer: true } }) : empty,
    can("finance_applications:view") ? db.financeApplication.findMany({ where: { customer: { name: ci } }, take: 6, include: { customer: true } }) : empty,
  ]) : [empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty];
  const total = [customers, vehicles, orders, payments, products, admins, leads, tasks, bookings, tradeins, finance].reduce((a, b) => a + b.length, 0);
  return (
    <>
      <PageHeader title="Global search" sub="Customers, vehicles, orders, payments, products, admins, leads, tasks, bookings, trade-ins and finance." />
      <form className="mb-6 flex gap-2" role="search"><label htmlFor="gs" className="sr-only">Search</label><input id="gs" name="q" defaultValue={q} autoFocus className="input" placeholder="Name, email, phone, VIN, SKU, order no., payment reference…" /><button className="btn-primary">Search</button></form>
      {q && total === 0 && <p className="card p-6 text-center text-sm text-muted">Nothing found for “{q}”.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Group title="Customers" n={customers.length}>{customers.map((c) => <li key={c.id} className="py-2">{c.name} <span className="text-muted">· {c.email} · {c.phone}</span></li>)}</Group>
        <Group title="Vehicles" n={vehicles.length}>{vehicles.map((v) => <li key={v.id} className="py-2"><Link className="text-brand hover:underline" href={`/admin/products/${v.id}`}>{v.name}</Link> <span className="text-muted">· {v.vehicle?.stockNumber} · {v.vehicle?.vin}</span></li>)}</Group>
        <Group title="Orders" n={orders.length}>{orders.map((o) => <li key={o.id} className="py-2"><Link className="text-brand hover:underline" href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link> <span className="text-muted">· {o.customer.name} · {formatNaira(Number(o.grandTotal), { whole: true })}</span></li>)}</Group>
        <Group title="Payments" n={payments.length}>{payments.map((p) => <li key={p.id} className="py-2"><Link className="text-brand hover:underline" href={`/admin/payments?q=${p.reference}`}>{p.reference}</Link> <span className="text-muted">· {p.order.orderNumber}</span> <Pill>{p.status.replace(/_/g, " ")}</Pill></li>)}</Group>
        <Group title="Products" n={products.length}>{products.map((p) => <li key={p.id} className="py-2"><Link className="text-brand hover:underline" href={`/admin/products/${p.id}`}>{p.name}</Link> <span className="text-muted">· {p.sku}</span></li>)}</Group>
        <Group title="Admins" n={admins.length}>{admins.map((a) => <li key={a.id} className="py-2">{a.name} <span className="text-muted">· {a.role?.name}</span></li>)}</Group>
        <Group title="Leads" n={leads.length}>{leads.map((l) => <li key={l.id} className="py-2">{l.name} <span className="text-muted">· {l.stage} · {l.interest}</span></li>)}</Group>
        <Group title="Tasks" n={tasks.length}>{tasks.map((t) => <li key={t.id} className="py-2">{t.title} <Pill>{t.status}</Pill></li>)}</Group>
        <Group title="Service bookings" n={bookings.length}>{bookings.map((b) => <li key={b.id} className="py-2">{b.service.name} <span className="text-muted">· {b.customer.name} · {b.slotStart.toLocaleString("en-NG")}</span></li>)}</Group>
        <Group title="Trade-ins and swaps" n={tradeins.length}>{tradeins.map((t) => <li key={t.id} className="py-2">{t.year} {t.make} {t.model} <span className="text-muted">· {t.customer.name} · {t.status}</span></li>)}</Group>
        <Group title="Finance applications" n={finance.length}>{finance.map((f) => <li key={f.id} className="py-2">{f.customer.name} <span className="text-muted">· {formatNaira(Number(f.requested), { whole: true })} · {f.status}</span></li>)}</Group>
      </div>
    </>
  );
}
