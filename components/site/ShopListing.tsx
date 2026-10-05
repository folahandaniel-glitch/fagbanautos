import Link from "next/link";
import type { ProductType } from "@prisma/client";
import { db } from "@/lib/db";
import { listShop } from "@/lib/catalogue";
import { ProductCard } from "@/components/ui/cards";
import { Pager } from "@/components/ui/Pager";

const num = (v: string | string[] | undefined) => { const s = Array.isArray(v) ? v[0] : v; return s && /^\d+$/.test(s) ? Number(s) : undefined; };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function ShopListing({ title, intro, basePath, divisionSlug, types, sp, showFitment }: {
  title: string; intro: string; basePath: string; divisionSlug: string; types: ProductType[];
  sp: Record<string, string | string[] | undefined>; showFitment: boolean;
}) {
  const division = await db.division.findUnique({ where: { slug: divisionSlug }, include: { categories: { where: { parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { orderBy: { sortOrder: "asc" } } } } } });
  const f = { types, divisionId: division?.id, q: str(sp.q), category: str(sp.category), brand: str(sp.brand), grade: str(sp.grade), fitMake: str(sp.fitMake), fitModel: str(sp.fitModel), fitYear: num(sp.fitYear), sort: str(sp.sort), page: num(sp.page) ?? 1 };
  const [{ items, total, page, pages, fitting }, makes, brands] = await Promise.all([
    listShop(f),
    showFitment ? db.brand.findMany({ where: { isVehicleMake: true }, orderBy: { name: "asc" }, select: { name: true } }) : Promise.resolve([]),
    db.brand.findMany({ where: { isVehicleMake: false, products: { some: { type: { in: types }, status: "ACTIVE" } } }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
  ]);
  const params: Record<string, string | undefined> = { q: f.q, category: f.category, brand: f.brand, grade: f.grade, fitMake: f.fitMake, fitModel: f.fitModel, fitYear: f.fitYear?.toString(), sort: f.sort };
  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-brand">Home</Link> / <span className="text-ink">{title}</span></nav>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-navy">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{intro}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <form method="get" className="card h-fit space-y-4 p-4" aria-label="Filter products">
          <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={f.q} className="input" placeholder="Name, brand or part number" /></div>
          {showFitment && (
            <fieldset className="rounded-xl bg-brand-50 p-3">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-brand">Fits my car</legend>
              <label className="label" htmlFor="fitMake">Make</label>
              <select id="fitMake" name="fitMake" defaultValue={f.fitMake ?? ""} className="input"><option value="">Any</option>{makes.map((m) => <option key={m.name}>{m.name}</option>)}</select>
              <label className="label mt-2" htmlFor="fitModel">Model</label><input id="fitModel" name="fitModel" defaultValue={f.fitModel} className="input" placeholder="e.g. Camry" />
              <label className="label mt-2" htmlFor="fitYear">Year</label><input id="fitYear" name="fitYear" inputMode="numeric" defaultValue={f.fitYear} className="input" placeholder="e.g. 2021" />
            </fieldset>
          )}
          <div><label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={f.category ?? ""} className="input"><option value="">All</option>
              {division?.categories.map((c) => (<optgroup key={c.id} label={c.name}><option value={c.slug}>All {c.name}</option>{c.children.map((ch) => <option key={ch.id} value={ch.slug}>{ch.name}</option>)}</optgroup>))}
            </select></div>
          <div><label className="label" htmlFor="brand">Brand</label>
            <select id="brand" name="brand" defaultValue={f.brand ?? ""} className="input"><option value="">All brands</option>{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
          {types.includes("PART") && <div><label className="label" htmlFor="grade">Type</label>
            <select id="grade" name="grade" defaultValue={f.grade ?? ""} className="input"><option value="">OEM and aftermarket</option><option value="OEM">OEM (genuine)</option><option value="AFTERMARKET">Aftermarket</option></select></div>}
          <div><label className="label" htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={f.sort ?? ""} className="input"><option value="">Featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></div>
          <div className="flex gap-2"><button className="btn-primary flex-1">Apply</button><Link href={basePath} className="btn-ghost">Reset</Link></div>
        </form>
        <section aria-label="Results">
          <p className="mb-3 text-sm text-muted">{total} product{total === 1 ? "" : "s"}</p>
          {fitting && <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-ink">Showing items that fit your <strong>{[f.fitYear, f.fitMake, f.fitModel].filter(Boolean).join(" ")}</strong>, plus universal-fit items marked <em>confirm fit</em>.</p>}
          {items.length === 0 ? <div className="card p-10 text-center"><p className="font-display text-lg font-bold text-navy">Nothing found.</p><p className="mt-1 text-sm text-muted">Try different filters or <a className="font-semibold text-brand underline" href="/contact">ask our team</a>.</p></div> : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {items.map((p) => (
                <div key={p.id}><ProductCard p={p} href={`/shop/${p.slug}`} />
                  {fitting && (p.compat.length === 0 ? <p className="mt-1 text-xs text-warn">Universal: confirm fit</p> : <p className="mt-1 text-xs font-semibold text-ok">Fits your vehicle</p>)}
                </div>
              ))}
            </div>
          )}
          <Pager page={page} pages={pages} basePath={basePath} params={params} />
        </section>
      </div>
    </div>
  );
}
