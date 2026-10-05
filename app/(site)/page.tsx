import { jsonLd } from "@/lib/json-ld";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSite } from "@/lib/site";
import { getDivisions, divisionHref } from "@/lib/divisions";
import { Hero3D } from "@/components/site/Hero3D";
import { VehicleCard, ProductCard } from "@/components/ui/cards";


export const revalidate = 60;

const BODY_TYPES = ["SUV", "Sedan", "Pickup", "Hatchback", "Coupe", "Van"];

export default async function Home() {
  const [site, divisions, featured, accessories, count, makes] = await Promise.all([
    getSite(),
    getDivisions(),
    db.product.findMany({ where: { type: "VEHICLE", status: "ACTIVE", featured: true }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.product.findMany({ where: { type: { in: ["ACCESSORY", "TECHNOLOGY"] }, status: "ACTIVE", featured: true }, include: { images: { take: 1 } }, take: 8 }),
    db.product.count({ where: { type: "VEHICLE", status: "ACTIVE" } }),
    db.vehicle.groupBy({ by: ["makeName"], _count: true, orderBy: { _count: { makeName: "desc" } }, take: 10 }),
  ]);
  const ld = {
    "@context": "https://schema.org", "@type": "AutoDealer", name: site.flagship, url: site.appUrl, telephone: site.phone1, email: site.email,
    address: { "@type": "PostalAddress", streetAddress: site.address, addressCountry: "NG" }, slogan: site.tagline,
    parentOrganization: { "@type": "Organization", name: site.name },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Hero3D>
        <p className="badge-gold !bg-white/10 !text-accent">{site.flagship}</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Driven by <span className="text-accent">Trust.</span><br />Powered by <span className="text-accent">Choice.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">
          Nigeria&apos;s premium automotive marketplace: verified vehicles, genuine parts, accessories, expert auto care, flexible financing and global imports, all under one roof.
        </p>
        <form action="/cars" className="glass mt-7 flex flex-col gap-2 rounded-2xl p-2 sm:flex-row" role="search">
          <label htmlFor="hero-q" className="sr-only">Search vehicles</label>
          <input id="hero-q" name="q" className="min-h-12 flex-1 rounded-xl bg-white px-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Make, model or keyword, e.g. Toyota Camry" />
          <button className="btn-gold !min-h-12">Search</button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/cars" className="btn-gold">EXPLORE VEHICLES</Link>
          <Link href="/imports" className="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">FIND YOUR NEXT CAR</Link>
        </div>
        <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 text-center">
          {[[`${count}+`, "Vehicles listed"], ["7", "Divisions"], ["24/7", "WhatsApp support"]].map(([n, l]) => (
            <div key={l}><dt className="sr-only">{l}</dt><dd className="font-display text-2xl font-bold text-accent">{n}</dd><dd className="text-xs text-white/65">{l}</dd></div>
          ))}
        </dl>
      </Hero3D>

      <section className="container-x -mt-8 relative z-10" aria-labelledby="divisions-h">
        <h2 id="divisions-h" className="sr-only">FAGDAN divisions</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {divisions.map((d) => (
            <li key={d.id}>
              <Link href={divisionHref(d.slug)} className="card tilt flex h-full flex-col justify-between p-4">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-sm font-bold text-white">{d.name.replace("FAGDAN ", "").slice(0, 1)}</span>
                <span className="mt-3 text-sm font-bold leading-tight text-navy">{d.name.replace("FAGDAN ", "")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-x mt-14">
        <div className="flex items-end justify-between">
          <h2 className="section-title">Featured vehicles</h2>
          <Link href="/cars" className="text-sm font-semibold text-brand hover:underline">View all {count} cars</Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => <VehicleCard key={p.id} p={p} />)}
        </div>
      </section>

      <section className="container-x mt-14 grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="section-title">Shop by body type</h2>
          <div className="mt-4 flex flex-wrap gap-2">{BODY_TYPES.map((b) => <Link key={b} href={`/cars?body=${b}`} className="btn-ghost !min-h-10">{b}</Link>)}</div>
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Popular makes</h3>
          <div className="mt-3 flex flex-wrap gap-2">{makes.map((m) => <Link key={m.makeName} href={`/cars?make=${encodeURIComponent(m.makeName)}`} className="chip">{m.makeName} ({m._count})</Link>)}</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-navy p-6 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/25 blur-2xl" aria-hidden="true" />
          <p className="badge-gold !bg-white/10 !text-accent">FAGDAN Vehicle Finance</p>
          <h2 className="mt-3 font-display text-2xl font-bold">Own it now. Pay in installments.</h2>
          <p className="mt-2 text-sm text-white/75">Eligible vehicles are available on FAGDAN installment terms. A transparent price, a clear schedule, and release once at least 90% is paid and verified.</p>
          <div className="mt-5 flex gap-3"><Link href="/finance" className="btn-gold">How it works</Link><Link href="/cars?installment=1" className="btn bg-white/10 text-white ring-1 ring-white/25">Installment cars</Link></div>
        </div>
      </section>

      <section className="container-x mt-14">
        <div className="flex items-end justify-between">
          <h2 className="section-title">Accessories &amp; technology for every drive</h2>
          <Link href="/accessories" className="text-sm font-semibold text-brand hover:underline">Shop all</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {accessories.map((p) => <ProductCard key={p.id} p={p} href={`/shop/${p.slug}`} />)}
        </div>
      </section>

      <section className="container-x mt-14 grid gap-5 md:grid-cols-3">
        {[
          ["Verified and transparent", "Every listing shows its inspection status, origin and full price breakdown, including VAT, before you pay."],
          ["Secure payments", `Pay with card, bank transfer or USSD via Paystack, or by verified bank transfer. Server-side verification on every payment.`],
          ["We source it for you", "Can't find your car? FAGDAN Imports sources, ships, clears and delivers from Japan, USA, Canada, Germany, Korea, China and the UK."],
        ].map(([t, d]) => (
          <div key={t} className="card p-6"><h3 className="font-display text-lg font-bold text-navy">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
        ))}
      </section>
    </>
  );
}
