import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { listShop, parseSmartQuery, fitmentWhere } from "@/lib/catalogue";
import { VehicleCard, ProductCard } from "@/components/ui/cards";

export const metadata: Metadata = { title: "Search", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Universal search across vehicles, parts, accessories, technology, services and brands, with fitment-aware parsing. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  if (!q) return <div className="container-x py-12"><h1 className="font-display text-2xl font-bold text-navy">Search</h1><p className="mt-2 text-muted">Type what you are looking for in the search box.</p></div>;
  const parsed = await parseSmartQuery(q);
  const words = parsed.keywords.split(" ").filter((w) => w.length > 1);
  const hasFit = !!parsed.make;

  const [vehicles, shop, services, brands] = await Promise.all([
    db.product.findMany({
      where: { type: "VEHICLE", status: "ACTIVE", AND: [parsed.make ? { vehicle: { makeName: { equals: parsed.make, mode: "insensitive" }, ...(parsed.model ? { modelName: { equals: parsed.model, mode: "insensitive" } } : {}), ...(parsed.year ? { year: parsed.year } : {}) } } : {}, ...words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { description: { contains: w, mode: "insensitive" as const } }] }))] },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true }, take: 6,
    }),
    // parts/accessories: when a vehicle was named, restrict to fitment (+ universal) and use remaining words as keywords
    hasFit
      ? db.product.findMany({
          where: { type: { in: ["PART", "ACCESSORY", "TECHNOLOGY"] }, status: "ACTIVE", AND: [{ OR: [{ compat: { some: fitmentWhere(parsed.make!, parsed.model, parsed.year) } }, { compat: { none: {} } }] }, ...words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { category: { name: { contains: w, mode: "insensitive" as const } } }, { brand: { name: { contains: w, mode: "insensitive" as const } } }] }))] },
          include: { images: { take: 1 }, compat: { select: { id: true } } }, orderBy: [{ compat: { _count: "desc" } }], take: 12,
        })
      : listShop({ types: ["PART", "ACCESSORY", "TECHNOLOGY"], q, page: 1 }).then((r) => r.items),
    db.service.findMany({ where: { isActive: true, OR: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })).concat(words.length ? [] : [{ name: { contains: q, mode: "insensitive" as const } }]) }, take: 6 }),
    db.brand.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 6 }),
  ]);
  const total = vehicles.length + shop.length + services.length;
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-2xl font-extrabold text-navy">Results for “{q}”</h1>
      {hasFit && <p className="mt-2 rounded-xl bg-brand-50 p-3 text-sm">Matching parts and accessories for your <strong>{[parsed.year, parsed.make, parsed.model].filter(Boolean).join(" ")}</strong>{parsed.keywords ? <> filtered by “{parsed.keywords}”</> : null}. Universal items are marked, please confirm fit.</p>}
      {total === 0 && <div className="card mt-6 p-10 text-center"><p className="font-display text-lg font-bold text-navy">No results found.</p><p className="mt-1 text-sm text-muted">Check the spelling, or <Link href="/imports" className="font-semibold text-brand underline">ask FAGDAN to source it</Link>.</p></div>}
      {brands.length > 0 && <p className="mt-4 flex flex-wrap gap-2 text-sm">Brands: {brands.map((b) => <Link key={b.id} className="chip" href={b.isVehicleMake ? `/cars?make=${encodeURIComponent(b.name)}` : `/accessories?brand=${b.slug}`}>{b.name}</Link>)}</p>}
      {vehicles.length > 0 && <section className="mt-8"><div className="flex items-end justify-between"><h2 className="section-title">Vehicles</h2><Link className="text-sm font-semibold text-brand hover:underline" href={`/cars?q=${encodeURIComponent(q)}`}>See all</Link></div><div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map((p) => <VehicleCard key={p.id} p={p} />)}</div></section>}
      {shop.length > 0 && <section className="mt-10"><h2 className="section-title">Parts, accessories and technology</h2><div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">{shop.map((p) => { const compat = (p as { compat?: { id: string }[] }).compat; return <div key={p.id}><ProductCard p={p} href={`/shop/${p.slug}`} />{hasFit && compat && (compat.length ? <p className="mt-1 text-xs font-semibold text-ok">Fits your vehicle</p> : <p className="mt-1 text-xs text-warn">Universal: confirm fit</p>)}</div>; })}</div></section>}
      {services.length > 0 && <section className="mt-10"><h2 className="section-title">Services</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{services.map((s) => <li key={s.id}><Link href={`/auto-care/${s.slug}`} className="card tilt block p-4"><p className="font-semibold text-navy">{s.name}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p></Link></li>)}</ul></section>}
    </div>
  );
}
