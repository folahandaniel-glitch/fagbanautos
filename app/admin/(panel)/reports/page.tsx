import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { PageHeader, Stat, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Reports and exports", robots: { index: false } };
export const dynamic = "force-dynamic";

const EXPORTS: [string, string, string[]][] = [
  ["inventory", "Inventory", ["inventory:export", "vehicles:export", "products:export"]], ["orders", "Orders", ["orders:export"]], ["customers", "Customers", ["customers:view"]], ["payments", "Payments", ["payments:export"]],
  ["vat", "VAT", ["vat:export"]], ["installments", "Installments", ["installments:view", "payments:export"]], ["sales", "Sales", ["reports:export", "orders:export"]], ["services", "Service bookings", ["bookings:view"]],
  ["tradeins", "Trade-ins", ["tradeins:view"]], ["swaps", "Swaps", ["swaps:view"]], ["imports", "Imports", ["imports:view"]],
];

export default async function Reports() {
  const user = await requireStaffPage("reports:view");
  const [fin, byBrand, byCat, stock] = await Promise.all([
    db.order.aggregate({ where: { status: { notIn: ["CANCELLED"] } }, _sum: { subtotal: true, discountTotal: true, vatTotal: true, grandTotal: true, amountPaid: true, tradeInCredit: true, chargesTotal: true } }),
    db.$queryRaw<{ make: string; n: bigint }[]>`SELECT v."makeName" make, COUNT(*) n FROM "Vehicle" v JOIN "Product" p ON p.id=v."productId" WHERE p.status='ACTIVE' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    db.$queryRaw<{ cat: string | null; n: bigint; stock: bigint }[]>`SELECT c.name cat, COUNT(*) n, SUM(p."stockOnHand") stock FROM "Product" p LEFT JOIN "Category" c ON c.id=p."categoryId" WHERE p.status='ACTIVE' AND p.type<>'VEHICLE' GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    db.product.aggregate({ _sum: { stockOnHand: true, stockReserved: true, stockSold: true } }),
  ]);
  const gross = Number(fin._sum.subtotal ?? 0), disc = Number(fin._sum.discountTotal ?? 0), vat = Number(fin._sum.vatTotal ?? 0), total = Number(fin._sum.grandTotal ?? 0), paid = Number(fin._sum.amountPaid ?? 0), tin = Number(fin._sum.tradeInCredit ?? 0);
  return (
    <>
      <PageHeader title="Reports and exports" sub="Financial and inventory summaries, plus Excel exports for accounting." />
      <h2 className="mb-3 font-display text-lg font-bold text-navy">Financial summary</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gross sales" value={formatNaira(gross, { whole: true })} /><Stat label="Discounts" value={formatNaira(disc, { whole: true })} /><Stat label="VAT" value={formatNaira(vat, { whole: true })} />
        <Stat label="Net sales (excl. VAT)" value={formatNaira(total - vat, { whole: true })} /><Stat label="Payments received" value={formatNaira(paid, { whole: true })} tone="ok" /><Stat label="Outstanding balances" value={formatNaira(Math.max(0, total - tin - paid), { whole: true })} tone="warn" />
        <Stat label="Trade-in credits" value={formatNaira(tin, { whole: true })} /><Stat label="Other charges" value={formatNaira(Number(fin._sum.chargesTotal ?? 0), { whole: true })} />
      </div>
      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-navy">Inventory summary</h2>
      <div className="grid grid-cols-3 gap-4"><Stat label="Total stock units" value={String(stock._sum.stockOnHand ?? 0)} /><Stat label="Reserved" value={String(stock._sum.stockReserved ?? 0)} /><Stat label="Sold" value={String(stock._sum.stockSold ?? 0)} /></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Vehicles by make</h3><Table head={["Make", "Active"]}>{byBrand.map((b) => <tr key={b.make}><td className="td">{b.make}</td><td className="td">{Number(b.n)}</td></tr>)}</Table></div>
        <div><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Products by category</h3><Table head={["Category", "Products", "Stock"]}>{byCat.map((c) => <tr key={c.cat ?? "none"}><td className="td">{c.cat ?? "Uncategorised"}</td><td className="td">{Number(c.n)}</td><td className="td">{Number(c.stock)}</td></tr>)}</Table></div>
      </div>
      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-navy">Excel exports</h2>
      <div className="flex flex-wrap gap-2">{EXPORTS.filter(([, , perms]) => perms.some((p) => user.permissions.has(p))).map(([k, l]) => <Link key={k} href={`/admin/export/${k}`} className="btn-ghost">{l}</Link>)}</div>
    </>
  );
}
