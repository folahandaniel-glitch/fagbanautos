import type { Metadata } from "next";
import Link from "next/link";
import { listVehicles, parseVehicleFilters, vehicleFacets } from "@/lib/catalogue";
import { VehicleCard, conditionLabel } from "@/components/ui/cards";
import { Pager } from "@/components/ui/Pager";

export const metadata: Metadata = { title: "Cars for sale in Nigeria", description: "Browse brand new, foreign used, Nigerian used and certified used cars with transparent pricing.", alternates: { canonical: "/cars" } };
export const dynamic = "force-dynamic";

const CONDITIONS = ["BRAND_NEW", "FOREIGN_USED", "NIGERIAN_USED", "CERTIFIED_USED", "NEARLY_NEW", "EXECUTIVE_USED"];

export default async function CarsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const f = parseVehicleFilters(sp);
  const [{ items, total, page, pages }, facets] = await Promise.all([listVehicles(f), vehicleFacets()]);
  const params: Record<string, string | undefined> = { q: f.q, make: f.make, body: f.body, condition: f.condition, origin: f.origin, fuel: f.fuel, transmission: f.transmission, yearFrom: f.yearFrom?.toString(), yearTo: f.yearTo?.toString(), minPrice: f.minPrice?.toString(), maxPrice: f.maxPrice?.toString(), installment: f.installment ? "1" : undefined, sort: f.sort };
  const active = Object.entries(params).filter(([k, v]) => v && k !== "sort");
  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-brand">Home</Link> / <span className="text-ink">Cars</span></nav>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-navy">Cars for sale</h1>
      <p className="mt-1 text-sm text-muted">{total} vehicle{total === 1 ? "" : "s"} found</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <form method="get" className="card h-fit space-y-4 p-4" aria-label="Filter vehicles">
          <div><label className="label" htmlFor="q">Keyword</label><input id="q" name="q" defaultValue={f.q} className="input" placeholder="e.g. Camry" /></div>
          <div><label className="label" htmlFor="make">Make</label>
            <select id="make" name="make" defaultValue={f.make ?? ""} className="input"><option value="">All makes</option>{facets.makes.map((m) => <option key={m.makeName} value={m.makeName}>{m.makeName} ({m._count})</option>)}</select></div>
          <div><label className="label" htmlFor="body">Body type</label>
            <select id="body" name="body" defaultValue={f.body ?? ""} className="input"><option value="">All</option>{facets.bodies.map((b) => <option key={b.bodyType} value={b.bodyType}>{b.bodyType}</option>)}</select></div>
          <div><label className="label" htmlFor="condition">Condition</label>
            <select id="condition" name="condition" defaultValue={f.condition ?? ""} className="input"><option value="">Any</option>{CONDITIONS.map((c) => <option key={c} value={c}>{conditionLabel(c)}</option>)}</select></div>
          <div><label className="label" htmlFor="origin">Origin</label>
            <select id="origin" name="origin" defaultValue={f.origin ?? ""} className="input"><option value="">Any</option>{facets.origins.map((o) => <option key={o.origin!} value={o.origin!}>{o.origin}</option>)}</select></div>
          <div><label className="label" htmlFor="fuel">Fuel</label>
            <select id="fuel" name="fuel" defaultValue={f.fuel ?? ""} className="input"><option value="">Any</option>{facets.fuels.map((o) => <option key={o.fuelType} value={o.fuelType}>{o.fuelType}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="yearFrom">Year from</label><input id="yearFrom" name="yearFrom" inputMode="numeric" defaultValue={f.yearFrom} className="input" placeholder="2018" /></div>
            <div><label className="label" htmlFor="yearTo">Year to</label><input id="yearTo" name="yearTo" inputMode="numeric" defaultValue={f.yearTo} className="input" placeholder="2025" /></div>
            <div><label className="label" htmlFor="minPrice">Min price (₦)</label><input id="minPrice" name="minPrice" inputMode="numeric" defaultValue={f.minPrice} className="input" /></div>
            <div><label className="label" htmlFor="maxPrice">Max price (₦)</label><input id="maxPrice" name="maxPrice" inputMode="numeric" defaultValue={f.maxPrice} className="input" /></div>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="installment" value="1" defaultChecked={f.installment} className="h-4 w-4" /> FAGDAN installment available</label>
          <div><label className="label" htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" defaultValue={f.sort ?? ""} className="input"><option value="">Featured</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="year_desc">Newest year</option></select></div>
          <div className="flex gap-2"><button className="btn-primary flex-1">Apply</button><Link href="/cars" className="btn-ghost">Reset</Link></div>
        </form>

        <section aria-label="Results">
          {active.length > 0 && <p className="mb-3 flex flex-wrap gap-2 text-xs">{active.map(([k, v]) => <span key={k} className="chip">{k}: {v}</span>)}</p>}
          {items.length === 0 ? (
            <div className="card p-10 text-center"><p className="font-display text-lg font-bold text-navy">No vehicles match your search.</p><p className="mt-2 text-sm text-muted">Try fewer filters, or let FAGDAN source it for you.</p><Link href="/imports" className="btn-primary mt-4">Request an import</Link></div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <VehicleCard key={p.id} p={p} />)}</div>
          )}
          <Pager page={page} pages={pages} basePath="/cars" params={params} />
        </section>
      </div>
    </div>
  );
}
