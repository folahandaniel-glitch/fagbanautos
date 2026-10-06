import { jsonLd } from "@/lib/json-ld";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSite } from "@/lib/site";
import { getContent, accentLines } from "@/lib/content";
import { getDivisions, divisionHref } from "@/lib/divisions";
import { Hero3D } from "@/components/site/Hero3D";
import { VehicleCard, ProductCard } from "@/components/ui/cards";

export const revalidate = 60;

export default async function Home() {
  const [site, c, divisions, featured, newest, accessories, count, makes, cats] = await Promise.all([
    getSite(),
    getContent(),
    getDivisions(),
    db.product.findMany({ where: { type: "VEHICLE", status: "ACTIVE", featured: true }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.product.findMany({ where: { type: "VEHICLE", status: "ACTIVE" }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.product.findMany({ where: { type: { in: ["ACCESSORY", "TECHNOLOGY"] }, status: "ACTIVE" }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 8 }),
    db.product.count({ where: { type: "VEHICLE", status: "ACTIVE" } }),
    db.vehicle.groupBy({ by: ["makeName"], where: { product: { status: "ACTIVE" } }, _count: true, orderBy: { _count: { makeName: "desc" } }, take: 10 }),
    db.category.findMany({ where: { parentId: null, division: { slug: { in: ["auto-accessories", "auto-parts", "auto-technology"] }, isVisible: true }, products: { some: { status: "ACTIVE" } } }, include: { division: { select: { slug: true } } }, orderBy: { sortOrder: "asc" }, take: 8 }),
  ]);
  const showDemo = c.flag("site.showDemoLabels");
  const ld = {
    "@context": "https://schema.org", "@type": "AutoDealer", name: site.flagship, url: site.appUrl, telephone: site.phone1, email: site.email,
    address: { "@type": "PostalAddress", streetAddress: site.address, addressCountry: "NG" }, slogan: site.tagline, parentOrganization: { "@type": "Organization", name: site.name },
  };
  const lines = accentLines(c.t("home.headline"));
  const bodyTypes = c.list("home.bodyTypes");
  const stats: [string, string][] = [[`${count}+`, c.t("home.stat1Label")], [String(divisions.length), c.t("home.stat2Label")], [c.t("home.stat3Value"), c.t("home.stat3Label")]];
  const trust: [string, string][] = [1, 2, 3].map((n) => [c.t(`home.trust${n}Title`), c.t(`home.trust${n}Text`)] as [string, string]);
  const catHref = (slug: string, categorySlug: string) => `${slug === "auto-parts" ? "/parts" : slug === "auto-technology" ? "/technology" : "/accessories"}?category=${categorySlug}`;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Hero3D fallbackImage={c.t("home.heroImage") || undefined}>
        <p className="badge-gold !bg-white/10 !text-accent">{site.flagship}</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {lines.map((segs, i) => <span key={i} className="block">{segs.map((s, j) => (s.accent ? <span key={j} className="text-accent">{s.text}</span> : <span key={j}>{s.text}</span>))}</span>)}
        </h1>
        <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">{c.t("home.subheadline")}</p>
        <form action="/cars" className="glass mt-7 flex flex-col gap-2 rounded-2xl p-2 sm:flex-row" role="search">
          <label htmlFor="hero-q" className="sr-only">Search vehicles</label>
          <input id="hero-q" name="q" className="min-h-12 flex-1 rounded-xl bg-white px-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" placeholder={c.t("home.searchPlaceholder")} />
          <button className="btn-gold !min-h-12">{c.t("home.searchButton")}</button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={c.t("home.cta1Href") || "/cars"} className="btn-gold">{c.t("home.cta1Label")}</Link>
          <Link href={c.t("home.cta2Href") || "/imports"} className="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">{c.t("home.cta2Label")}</Link>
        </div>
        <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 text-center">
          {stats.map(([n, l]) => (
            <div key={l}><dt className="sr-only">{l}</dt><dd className="font-display text-2xl font-bold text-accent">{n}</dd><dd className="text-xs text-white/65">{l}</dd></div>
          ))}
        </dl>
      </Hero3D>

      <section className="container-x relative z-10 -mt-8" aria-labelledby="divisions-h">
        <h2 id="divisions-h" className="sr-only">FAGDAN divisions</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {divisions.map((d) => (
            <li key={d.id}>
              <Link href={divisionHref(d.slug)} className="card tilt flex h-full flex-col justify-between p-4">
                <span className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: d.accent ?? "var(--brand)" }}>{d.name.replace("FAGDAN ", "").slice(0, 1)}</span>
                <span className="mt-3 text-sm font-bold leading-tight text-navy">{d.name.replace("FAGDAN ", "")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured.length > 0 && (
        <section className="container-x mt-14">
          <div className="flex items-end justify-between">
            <h2 className="section-title">{c.t("home.featuredTitle")}</h2>
            <Link href="/cars" className="text-sm font-semibold text-brand hover:underline">{c.t("home.featuredLink")} ({count})</Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{featured.map((p) => <VehicleCard key={p.id} p={p} showDemo={showDemo} />)}</div>
        </section>
      )}

      <section className="container-x mt-14 grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="section-title">{c.t("home.shopByTitle")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">{bodyTypes.map((b) => <Link key={b} href={`/cars?body=${encodeURIComponent(b)}`} className="btn-ghost !min-h-10">{b}</Link>)}</div>
          {makes.length > 0 && <>
            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">{c.t("home.makesTitle")}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{makes.map((m) => <Link key={m.makeName} href={`/cars?make=${encodeURIComponent(m.makeName)}`} className="chip">{m.makeName} ({m._count})</Link>)}</div>
          </>}
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-navy p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/25 blur-2xl" aria-hidden="true" />
          <p className="badge-gold !bg-white/10 !text-accent">{c.t("home.financeBadge")}</p>
          <h2 className="mt-3 font-display text-2xl font-bold">{c.t("home.financeTitle")}</h2>
          <p className="mt-2 text-sm text-white/75">{c.t("home.financeText")}</p>
          <div className="mt-5 flex gap-3"><Link href="/finance" className="btn-gold">{c.t("home.financeCta1")}</Link><Link href="/cars?installment=1" className="btn bg-white/10 text-white ring-1 ring-white/25">{c.t("home.financeCta2")}</Link></div>
        </div>
      </section>

      {newest.length > 0 && (
        <section className="container-x mt-14">
          <div className="flex items-end justify-between"><h2 className="section-title">New arrivals</h2><Link href="/cars?sort=year_desc" className="text-sm font-semibold text-brand hover:underline">See newest</Link></div>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{newest.map((p) => <VehicleCard key={p.id} p={p} showDemo={showDemo} />)}</div>
        </section>
      )}

      {cats.length > 0 && (
        <section className="container-x mt-14">
          <h2 className="section-title">Shop by category</h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{cats.map((cat) => <li key={cat.id}><Link href={catHref(cat.division.slug, cat.slug)} className="card tilt block p-4 text-sm font-semibold text-navy">{cat.name}</Link></li>)}</ul>
        </section>
      )}

      {accessories.length > 0 && (
        <section className="container-x mt-14">
          <div className="flex items-end justify-between">
            <h2 className="section-title">{c.t("home.accessoriesTitle")}</h2>
            <Link href="/accessories" className="text-sm font-semibold text-brand hover:underline">{c.t("home.accessoriesLink")}</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{accessories.map((p) => <ProductCard key={p.id} p={p} href={`/shop/${p.slug}`} showDemo={showDemo} />)}</div>
        </section>
      )}

      <section className="container-x mt-14 grid gap-5 md:grid-cols-3">
        {trust.map(([t, d]) => (
          <div key={t} className="card p-6"><h3 className="font-display text-lg font-bold text-navy">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
        ))}
      </section>
    </>
  );
}
