import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProductType } from "@prisma/client";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { saveProduct } from "@/app/actions/admin-products";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Edit product", robots: { index: false } };
export const dynamic = "force-dynamic";
const TYPES: ProductType[] = ["VEHICLE", "PART", "ACCESSORY", "TECHNOLOGY", "SERVICE", "OTHER"];
const CONDITIONS = ["BRAND_NEW", "FOREIGN_USED", "NIGERIAN_USED", "CERTIFIED_USED", "NEARLY_NEW", "EXECUTIVE_USED"];

export default async function ProductEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const p = isNew ? null : await db.product.findUnique({ where: { id }, include: { vehicle: true, images: { orderBy: { sortOrder: "asc" } }, compat: true } });
  if (!isNew && !p) notFound();
  const type = (p?.type ?? (TYPES.includes(sp.type as ProductType) ? sp.type : "PART")) as ProductType;
  const isVehicle = type === "VEHICLE";
  const res = isVehicle ? "vehicles" : "products";
  if (!user.permissions.has(`${res}:${isNew ? "create" : "edit"}`) && !user.permissions.has(`${res}:view`) && !user.permissions.has("inventory:view")) await requireStaffPage(`${res}:view`);
  const canSave = user.permissions.has(`${res}:${isNew ? "create" : "edit"}`) || user.permissions.has(`inventory:${isNew ? "create" : "edit"}`);
  const [divisions, categories, brands] = await Promise.all([db.division.findMany({ orderBy: { sortOrder: "asc" } }), db.category.findMany({ orderBy: [{ divisionId: "asc" }, { name: "asc" }] }), db.brand.findMany({ orderBy: { name: "asc" } })]);
  const v = p?.vehicle;
  const field = (name: string, label: string, def?: string | number | null, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={def ?? ""} className="input" disabled={!canSave} {...extra} /></div>
  );
  return (
    <>
      <PageHeader title={isNew ? `New ${type.toLowerCase()}` : p!.name} sub={p ? `${p.sku} · ${p.type}` : "Create a new listing"} actions={<><Link href="/admin/inventory" className="btn-ghost">Back to inventory</Link>{p && <Link href={isVehicle ? `/cars/${p.slug}` : `/shop/${p.slug}`} target="_blank" className="btn-ghost">View on site</Link>}</>} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      {p?.isDemo && <Notice>This is demo/seed data. Replace the details and images with real stock before going live.</Notice>}
      <form action={saveProduct} encType="multipart/form-data" className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <input type="hidden" name="id" value={p?.id ?? ""} /><input type="hidden" name="type" value={type} />
        <div className="space-y-6">
          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-display text-lg font-bold text-navy sm:col-span-2">Basics</h2>
            <div className="sm:col-span-2">{field("name", "Name", p?.name, { required: true })}</div>
            {field("sku", "SKU", p?.sku, { required: true })}
            <div><label className="label" htmlFor="divisionId">Division</label><select id="divisionId" name="divisionId" defaultValue={p?.divisionId} className="input" disabled={!canSave}>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label" htmlFor="categoryId">Category</label><select id="categoryId" name="categoryId" defaultValue={p?.categoryId ?? ""} className="input" disabled={!canSave}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label" htmlFor="brandId">Brand</label><select id="brandId" name="brandId" defaultValue={p?.brandId ?? ""} className="input" disabled={!canSave}><option value="">None</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="sm:col-span-2">{field("shortDescription", "Short description", p?.shortDescription)}</div>
            <div className="sm:col-span-2"><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={p?.description ?? ""} className="input min-h-28" disabled={!canSave} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="features">Features (one per line)</label><textarea id="features" name="features" defaultValue={p?.features.join("\n")} className="input min-h-20" disabled={!canSave} /></div>
          </section>

          {isVehicle && (
            <section className="card grid gap-4 p-5 sm:grid-cols-2">
              <h2 className="font-display text-lg font-bold text-navy sm:col-span-2">Vehicle details</h2>
              {field("inventoryId", "Inventory ID (unique)", v?.inventoryId, { required: true })}{field("stockNumber", "Stock number (unique)", v?.stockNumber, { required: true })}
              {field("vin", "VIN (unique, if available)", v?.vin, { maxLength: 17 })}{field("year", "Year", v?.year, { required: true, inputMode: "numeric" })}
              {field("makeName", "Make", v?.makeName, { required: true })}{field("modelName", "Model", v?.modelName, { required: true })}
              {field("trim", "Trim", v?.trim)}{field("bodyType", "Body type", v?.bodyType, { required: true })}
              {field("fuelType", "Fuel", v?.fuelType, { required: true })}{field("transmission", "Transmission", v?.transmission, { required: true })}
              {field("driveType", "Drive", v?.driveType)}{field("engine", "Engine", v?.engine)}
              {field("horsepower", "Horsepower", v?.horsepower, { inputMode: "numeric" })}{field("mileageKm", "Mileage (km)", v?.mileageKm, { inputMode: "numeric" })}
              {field("colour", "Colour", v?.colour)}
              <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium"><input type="checkbox" name="installmentAvailable" defaultChecked={v?.installmentAvailable} disabled={!canSave} className="h-4 w-4" /> FAGDAN installment available</label>
            </section>
          )}

          {!isVehicle && (
            <section className="card grid gap-4 p-5 sm:grid-cols-2">
              <h2 className="font-display text-lg font-bold text-navy sm:col-span-2">Part / accessory details and compatibility</h2>
              {field("partNumber", "Part number", p?.partNumber)}
              <div><label className="label" htmlFor="partGrade">OEM or aftermarket</label><select id="partGrade" name="partGrade" defaultValue={p?.partGrade ?? ""} className="input" disabled={!canSave}><option value="">n/a</option><option value="OEM">OEM</option><option value="AFTERMARKET">Aftermarket</option></select></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="compat">Compatible vehicles (one per line: Make | Model | Year from | Year to)</label><textarea id="compat" name="compat" className="input min-h-24 font-mono text-xs" defaultValue={p?.compat.map((c) => `${c.makeName} | ${c.modelName ?? ""} | ${c.yearFrom ?? ""} | ${c.yearTo ?? ""}`).join("\n")} disabled={!canSave} placeholder="Toyota | Camry | 2018 | 2024" /><p className="mt-1 text-xs text-muted">Leave empty for universal-fit items. Customers are warned to confirm fit.</p></div>
            </section>
          )}

          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <h2 className="font-display text-lg font-bold text-navy sm:col-span-2">Images, SEO and details</h2>
            <div className="sm:col-span-2"><p className="label">Current images</p><ul className="flex flex-wrap gap-2">{p?.images.map((i) => <li key={i.id} className="text-xs">{i.isPlaceholder ? <Pill tone="gold">placeholder</Pill> : <Pill>photo</Pill>}</li>)}</ul></div>
            <div><label className="label" htmlFor="imageFile">Upload a photo (JPG, PNG, WebP; max 4 MB)</label><input id="imageFile" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" className="input !py-2" disabled={!canSave} /></div>
            <div><label className="label" htmlFor="imageUrls">Or image URLs (https, one per line)</label><textarea id="imageUrls" name="imageUrls" className="input min-h-16" disabled={!canSave} /></div>
            <p className="text-xs text-muted sm:col-span-2">Adding a real photo replaces the generated placeholder images for this listing.</p>
            {field("videoUrl", "Video URL", p?.videoUrl)}{field("warranty", "Warranty", p?.warranty)}
            {field("origin", "Origin country", p?.origin)}
            <div><label className="label" htmlFor="condition">Condition</label><select id="condition" name="condition" defaultValue={p?.condition ?? ""} className="input" disabled={!canSave}><option value="">n/a</option>{CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</select></div>
            <div className="sm:col-span-2">{field("seoTitle", "SEO title", p?.seoTitle)}</div>
            <div className="sm:col-span-2">{field("seoDescription", "SEO description", p?.seoDescription)}</div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-bold text-navy">Price and status</h2>
            {field("priceNaira", "Price (₦)", p ? Number(p.price) / 100 : "", { required: true, inputMode: "decimal" })}
            {field("discountNaira", "Discount (₦)", p ? Number(p.discount) / 100 : 0, { inputMode: "decimal" })}
            <div><label className="label" htmlFor="status">Status</label><select id="status" name="status" defaultValue={p?.status ?? "DRAFT"} className="input" disabled={!canSave}>{["DRAFT", "ACTIVE", "ARCHIVED", "SOLD"].map((s) => <option key={s}>{s}</option>)}</select></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="vatApplicable" defaultChecked={p?.vatApplicable ?? true} disabled={!canSave} className="h-4 w-4" /> Subject to VAT</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={p?.featured} disabled={!canSave} className="h-4 w-4" /> Featured</label>
          </section>
          {!isVehicle && (
            <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-bold text-navy">Stock</h2>
              {field("stockOnHand", "On hand", p?.stockOnHand ?? 0, { inputMode: "numeric" })}
              {p && <p className="text-xs text-muted">Reserved {p.stockReserved} · Sold {p.stockSold}. Reserved units are held by open orders.</p>}
              {field("lowStockThreshold", "Low-stock threshold", p?.lowStockThreshold ?? 3, { inputMode: "numeric" })}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowBackorder" defaultChecked={p?.allowBackorder} disabled={!canSave} className="h-4 w-4" /> Allow backorder</label></section>
          )}
          {canSave ? <button className="btn-primary w-full">{isNew ? "Create" : "Save changes"}</button> : <p className="text-sm text-muted">Read-only for your role.</p>}
        </aside>
      </form>
    </>
  );
}
