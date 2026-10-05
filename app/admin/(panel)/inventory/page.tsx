import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, ProductStatus, ProductType } from "@prisma/client";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { adjustStock } from "@/app/actions/admin-products";
import { PageHeader, Table, Pill, Notice, Stat } from "@/components/admin/ui";
import { Pager } from "@/components/ui/Pager";

export const metadata: Metadata = { title: "Inventory", robots: { index: false } };
export const dynamic = "force-dynamic";
const PAGE = 25;
const TYPES: ProductType[] = ["VEHICLE", "PART", "ACCESSORY", "TECHNOLOGY", "SERVICE", "OTHER"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string; q?: string; stock?: string; page?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffPage();
  if (!["vehicles:view", "products:view", "inventory:view"].some((p) => user.permissions.has(p))) await requireStaffPage("inventory:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProductWhereInput = {
    ...(sp.type && TYPES.includes(sp.type as ProductType) ? { type: sp.type as ProductType } : {}),
    ...(sp.status ? { status: sp.status as ProductStatus } : {}),
    ...(sp.stock === "low" ? { type: { not: "VEHICLE" }, status: "ACTIVE", stockOnHand: { lte: 5 } } : {}),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }, { partNumber: { contains: sp.q, mode: "insensitive" } }, { vehicle: { vin: { contains: sp.q, mode: "insensitive" } } }, { vehicle: { stockNumber: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const [items, total, counts, values] = await Promise.all([
    db.product.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { vehicle: true, category: true } }),
    db.product.count({ where }),
    db.product.groupBy({ by: ["type"], where: { status: "ACTIVE" }, _count: true }),
    db.$queryRaw<{ v: bigint | null; reserved: bigint | null }[]>`SELECT SUM(price * GREATEST("stockOnHand" - "stockReserved",0)) v, SUM("stockReserved") reserved FROM "Product" WHERE status='ACTIVE'`,
  ]);
  const canEdit = user.permissions.has("inventory:edit") || user.permissions.has("products:edit");
  const canCreate = user.permissions.has("vehicles:create") || user.permissions.has("products:create") || user.permissions.has("inventory:create");
  return (
    <>
      <PageHeader title="Inventory" sub="Vehicles, parts, accessories and technology. Stock changes are transactional and audited."
        actions={<>{canCreate && <><Link href="/admin/products/new?type=VEHICLE" className="btn-primary">Add vehicle</Link><Link href="/admin/products/new?type=PART" className="btn-ghost">Add part</Link><Link href="/admin/products/new?type=ACCESSORY" className="btn-ghost">Add accessory</Link></>}{user.permissions.has("inventory:export") && <Link href="/admin/export/inventory" className="btn-ghost">Export Excel</Link>}</>} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active listings" value={String(counts.reduce((a, c) => a + c._count, 0))} />
        <Stat label="Vehicles" value={String(counts.find((c) => c.type === "VEHICLE")?._count ?? 0)} />
        <Stat label="Inventory value" value={formatNaira(Number(values[0]?.v ?? 0), { whole: true })} sub="List price × available" />
        <Stat label="Units reserved" value={String(Number(values[0]?.reserved ?? 0))} />
      </div>
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Name, SKU, VIN, stock no." /></div>
        <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" defaultValue={sp.type ?? ""} className="input"><option value="">All</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option>{["DRAFT", "ACTIVE", "ARCHIVED", "SOLD"].map((t) => <option key={t}>{t}</option>)}</select></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="stock" value="low" defaultChecked={sp.stock === "low"} className="h-4 w-4" /> Low stock only</label>
        <button className="btn-primary">Filter</button>
      </form>
      <Table head={["Item", "SKU / Stock no.", "Type", "Price", "Stock", "Status", ""]} empty={items.length === 0 ? "Nothing found." : undefined}>
        {items.map((p) => {
          const avail = p.stockOnHand - p.stockReserved;
          return (
            <tr key={p.id}>
              <td className="td"><Link href={`/admin/products/${p.id}`} className="font-semibold text-brand hover:underline">{p.name}</Link>{p.isDemo && <span className="ml-2"><Pill tone="gold">demo</Pill></span>}{p.needsImage && <span className="ml-2"><Pill tone="warn">needs image</Pill></span>}</td>
              <td className="td font-mono text-xs">{p.vehicle?.stockNumber ?? p.sku}</td><td className="td">{p.type}</td><td className="td">{formatNaira(Number(p.price), { whole: true })}</td>
              <td className="td">{p.type === "VEHICLE" ? <Pill tone={avail > 0 ? "ok" : "warn"}>{avail > 0 ? "Available" : p.status === "SOLD" ? "Sold" : "Reserved"}</Pill> : (
                <div className="flex items-center gap-2"><span className={avail <= p.lowStockThreshold ? "font-bold text-danger" : ""}>{avail}</span><span className="text-xs text-muted">/ {p.stockOnHand} ({p.stockReserved} res.)</span>
                  {canEdit && <form action={adjustStock} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="returnTo" value="/admin/inventory" /><input name="delta" type="number" aria-label={`Change stock for ${p.name}`} className="input !min-h-8 !w-16 !px-2 !py-1 text-xs" placeholder="±" /><input name="reason" aria-label="Reason" className="input !min-h-8 !w-24 !px-2 !py-1 text-xs" placeholder="Reason" /><button className="btn-ghost !min-h-8 !px-2 text-xs">Adjust</button></form>}</div>)}</td>
              <td className="td"><Pill tone={p.status === "ACTIVE" ? "ok" : "info"}>{p.status}</Pill></td>
              <td className="td"><Link href={`/admin/products/${p.id}`} className="text-sm font-semibold text-brand hover:underline">Edit</Link></td>
            </tr>
          );
        })}
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} basePath="/admin/inventory" params={{ q: sp.q, type: sp.type, status: sp.status, stock: sp.stock }} />
    </>
  );
}
