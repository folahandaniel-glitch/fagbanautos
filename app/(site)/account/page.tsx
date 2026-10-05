import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/guard";
import { logout } from "@/app/actions/auth";
import { formatNaira } from "@/lib/money";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { PENDING_PAYMENT: "Pending payment", PAYMENT_VERIFICATION: "Verifying payment", PAID: "Paid", PARTIALLY_PAID: "Partially paid", PROCESSING: "Processing", RESERVED: "Reserved", READY_FOR_COLLECTION: "Ready for collection", READY_FOR_DELIVERY: "Ready for delivery", DELIVERED: "Delivered", COMPLETED: "Completed", CANCELLED: "Cancelled", REFUNDED: "Refunded" };

export default async function AccountPage() {
  const user = await requireCustomerPage();
  if (user.kind === "STAFF") return (
    <div className="container-x py-12"><p>You are signed in as staff. <Link href="/admin" className="font-semibold text-brand underline">Open the admin dashboard</Link>.</p></div>
  );
  const cid = user.customerId;
  const [orders, bookings, tradeIns, swaps, finance, imports, favs] = cid ? await Promise.all([
    db.order.findMany({ where: { customerId: cid }, orderBy: { createdAt: "desc" }, take: 20, include: { items: true, installment: true } }),
    db.serviceBooking.findMany({ where: { customerId: cid }, orderBy: { slotStart: "desc" }, take: 10, include: { service: true } }),
    db.tradeIn.findMany({ where: { customerId: cid }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.swapRequest.findMany({ where: { customerId: cid }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.financeApplication.findMany({ where: { customerId: cid }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.importCase.findMany({ where: { customerId: cid }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.favourite.count({ where: { customerId: cid } }),
  ]) : [[], [], [], [], [], [], 0];
  const notes = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-extrabold text-navy">Hello, {user.name.split(" ")[0]}</h1><p className="text-sm text-muted">{user.email}</p></div>
        <form action={logout}><button className="btn-ghost">Sign out</button></form>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="orders-h">
          <h2 id="orders-h" className="font-display text-lg font-bold text-navy">Orders and payments</h2>
          {orders.length === 0 ? <p className="mt-3 text-sm text-muted">No orders yet. <Link href="/cars" className="font-semibold text-brand underline">Browse cars</Link>.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {orders.map((o) => {
                const pct = Number(o.grandTotal) > 0 ? Math.min(100, Math.round((Number(o.amountPaid) / Math.max(1, Number(o.grandTotal) - Number(o.tradeInCredit))) * 100)) : 0;
                return (
                  <li key={o.id} className="py-3">
                    <Link href={`/order/${o.orderNumber}`} className="flex flex-wrap items-center justify-between gap-2">
                      <span><span className="font-semibold text-navy">{o.orderNumber}</span> <span className="chip ml-2">{STATUS[o.status]}</span>{o.paymentMode === "INSTALLMENT" && <span className="badge-gold ml-2">Installment</span>}</span>
                      <span className="text-sm font-semibold">{formatNaira(Number(o.grandTotal))}</span>
                    </Link>
                    <div className="mt-2 h-1.5 rounded-full bg-brand-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Payment progress"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1 text-xs text-muted">Paid {formatNaira(Number(o.amountPaid))} ({pct}%)</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="space-y-5">
          <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Notifications</h2>{notes.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing new.</p> : <ul className="mt-2 space-y-2 text-sm">{notes.map((n) => <li key={n.id}><strong>{n.title}</strong><br /><span className="text-muted">{n.body}</span></li>)}</ul>}</section>
          <section className="card p-5 text-sm"><h2 className="font-display text-lg font-bold text-navy">Requests</h2>
            <ul className="mt-2 space-y-1.5">
              <li>Service bookings: <strong>{bookings.length}</strong></li><li>Trade-ins: <strong>{tradeIns.length}</strong></li><li>Car swaps: <strong>{swaps.length}</strong></li>
              <li>Finance applications: <strong>{finance.length}</strong></li><li>Import cases: <strong>{imports.length}</strong></li><li>Favourites: <strong>{favs}</strong></li>
            </ul></section>
        </aside>
      </div>
      {(bookings.length > 0 || imports.length > 0) && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {bookings.length > 0 && <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Service bookings</h2><ul className="mt-2 space-y-2 text-sm">{bookings.map((b) => <li key={b.id}>{b.service.name} · {b.slotStart.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} · <span className="chip">{b.status}</span></li>)}</ul></section>}
          {imports.length > 0 && <section className="card p-5"><h2 className="font-display text-lg font-bold text-navy">Import cases</h2><ul className="mt-2 space-y-2 text-sm">{imports.map((c) => <li key={c.id}>{c.caseNumber} · {c.make} {c.model} · <span className="chip">{c.status.replace(/_/g, " ")}</span></li>)}</ul></section>}
        </div>
      )}
    </div>
  );
}
