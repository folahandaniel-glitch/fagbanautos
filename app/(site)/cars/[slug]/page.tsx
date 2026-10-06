import { jsonLd } from "@/lib/json-ld";
import { sweepExpiredReservations } from "@/lib/services/orders";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSite, waLink } from "@/lib/site";
import { getContent } from "@/lib/content";
import { ProductGallery } from "@/components/site/ProductGallery";
import { buildQuote } from "@/lib/services/orders";
import { accessoriesForVehicle } from "@/lib/catalogue";
import { formatNaira } from "@/lib/money";
import { SmartImage } from "@/components/ui/media";
import { ProductCard, conditionLabel } from "@/components/ui/cards";
import { addToCart } from "@/app/actions/cart";
import { requestTestDrive } from "@/app/actions/enquiry";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.product.findUnique({ where: { slug }, include: { images: { orderBy: { sortOrder: "asc" } }, vehicle: true, brand: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p || p.type !== "VEHICLE") return {};
  return { title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.shortDescription ?? undefined, alternates: { canonical: `/cars/${p.slug}` }, openGraph: { images: p.images[0] ? [p.images[0].url] : undefined } };
}

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p || p.type !== "VEHICLE" || !p.vehicle || p.status === "DRAFT" || p.status === "ARCHIVED") notFound();
  const v = p.vehicle;
  await sweepExpiredReservations();
  const site = await getSite();
  const content = await getContent();
  const showDemo = content.flag("site.showDemoLabels");
  const canBuy = !p.isDemo || content.flag("catalogue.allowDemoPurchases");
  const available = p.status === "ACTIVE" && p.stockOnHand - p.stockReserved > 0;
  const lines = [{ productId: p.id, quantity: 1 }];
  const outright = available ? await buildQuote({ lines, mode: "OUTRIGHT" }) : null;
  const inst = available && v.installmentAvailable ? await buildQuote({ lines, mode: "INSTALLMENT", deposit: 0 }) : null;
  const instWithDeposit = inst ? await buildQuote({ lines, mode: "INSTALLMENT", deposit: inst.minDeposit }) : null;
  const { fit, universal } = await accessoriesForVehicle(v.makeName, v.modelName, v.year, 8);
  const price = Number(p.price) - Number(p.discount);
  const specs: [string, string | number | null][] = [
    ["Make", v.makeName], ["Model", v.modelName], ["Year", v.year], ["Condition", conditionLabel(p.condition)], ["Origin", p.origin], ["Body type", v.bodyType],
    ["Fuel", v.fuelType], ["Transmission", v.transmission], ["Drive", v.driveType], ["Engine", v.engine], ["Horsepower", v.horsepower ? `${v.horsepower} hp` : null],
    ["Mileage", v.mileageKm != null ? `${v.mileageKm.toLocaleString("en-NG")} km` : null], ["Colour", v.colour], ["Stock number", v.stockNumber], ["Inventory ID", v.inventoryId], ["VIN", v.vin], ["Warranty", p.warranty],
  ];
  const ld = {
    "@context": "https://schema.org", "@type": "Vehicle", name: p.name, vehicleIdentificationNumber: p.isDemo ? undefined : v.vin ?? undefined, brand: { "@type": "Brand", name: v.makeName }, model: v.modelName,
    vehicleModelDate: String(v.year), mileageFromOdometer: v.mileageKm != null ? { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" } : undefined,
    fuelType: v.fuelType, vehicleTransmission: v.transmission, color: v.colour ?? undefined, image: p.images.map((i) => new URL(i.url, site.appUrl).toString()),
    offers: { "@type": "Offer", price: price / 100, priceCurrency: "NGN", availability: available ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: `${site.appUrl}/cars/${p.slug}` },
  };
  const wa = waLink(site.phone1, `Hello FAGDAN, I am interested in the ${p.name} (${v.stockNumber}).`);
  return (
    <div className="container-x py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-brand">Home</Link> / <Link href="/cars" className="hover:text-brand">Cars</Link> / <span className="text-ink">{p.name}</span></nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <ProductGallery images={p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, credit: i.credit, sourceUrl: i.sourceUrl }))} name={p.name} />
          {showDemo && p.isDemo && <p className="mt-3 rounded-xl bg-accent/15 p-3 text-sm text-ink"><strong>Demo listing.</strong> Images are generated illustrations and this vehicle is sample data, not physical inventory.</p>}
          <section className="mt-8"><h2 className="section-title">Overview</h2><p className="mt-3 text-sm leading-relaxed text-muted">{p.description}</p>
            {p.features.length > 0 && <ul className="mt-4 grid gap-2 sm:grid-cols-2">{p.features.map((f) => <li key={f} className="flex items-center gap-2 text-sm"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-50 text-xs text-brand" aria-hidden="true">✓</span>{f}</li>)}</ul>}
          </section>
          <section className="mt-8"><h2 className="section-title">Specifications</h2>
            <dl className="mt-3 grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-2">
              {specs.filter(([, val]) => val != null && val !== "").map(([k, val]) => <div key={k} className="flex justify-between gap-4 border-b border-line px-4 py-2.5 text-sm odd:sm:border-r"><dt className="text-muted">{k}</dt><dd className="text-right font-medium text-ink">{val}</dd></div>)}
            </dl>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="card p-5">
            <div className="flex flex-wrap gap-2"><span className="chip">{conditionLabel(p.condition)}</span>{v.installmentAvailable && <span className="badge-gold">Installment available</span>}</div>
            <h1 className="mt-3 font-display text-2xl font-extrabold text-navy">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">{v.stockNumber}</p>
            <p className="mt-4 font-display text-3xl font-extrabold text-navy">{formatNaira(price)}</p>
            {Number(p.discount) > 0 && <p className="text-sm text-muted"><span className="line-through">{formatNaira(Number(p.price))}</span> <span className="font-semibold text-ok">Save {formatNaira(Number(p.discount))}</span></p>}

            {outright && (
              <dl className="mt-4 space-y-1.5 rounded-xl bg-canvas p-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Price</dt><dd>{formatNaira(outright.pricing.subtotal - outright.pricing.discountTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">VAT ({outright.pricing.vatRateBps / 100}%)</dt><dd>{formatNaira(outright.pricing.vatTotal)}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5 font-bold text-navy"><dt>Outright total</dt><dd>{formatNaira(outright.pricing.grandTotal)}</dd></div>
              </dl>
            )}

            {available && !canBuy ? (
              <div className="mt-5 grid gap-2">
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">Enquire on WhatsApp</a>
                <Link href="/contact" className="btn-ghost w-full">Request details</Link>
                <p className="text-xs text-muted">Contact us to confirm availability, inspection and the final price.</p>
              </div>
            ) : available ? (
              <div className="mt-5 grid gap-2">
                <form action={addToCart}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="buyNow" value="1" /><button className="btn-primary w-full">Buy now (outright)</button></form>
                <form action={addToCart}><input type="hidden" name="productId" value={p.id} /><button className="btn-ghost w-full">Add to cart</button></form>
                {instWithDeposit && inst && <form action={addToCart}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="buyNow" value="1" /><input type="hidden" name="mode" value="installment" /><button className="btn-gold w-full">Buy on FAGDAN installment</button></form>}
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">WhatsApp enquiry</a>
              </div>
            ) : <p className="mt-5 rounded-xl bg-danger/10 p-3 text-sm font-semibold text-danger">This vehicle is currently reserved or sold.</p>}
          </div>

          {instWithDeposit && inst && (
            <div className="card border-accent/40 p-5">
              <h2 className="font-display text-base font-bold text-navy">FAGDAN installment</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Installment price</dt><dd>{formatNaira(inst.pricing.subtotal - inst.pricing.discountTotal + inst.pricing.upliftTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">VAT ({inst.pricing.vatRateBps / 100}%)</dt><dd>{formatNaira(inst.pricing.vatTotal)}</dd></div>
                <div className="flex justify-between font-bold text-navy"><dt>Installment total</dt><dd>{formatNaira(inst.pricing.grandTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Minimum deposit</dt><dd>{formatNaira(inst.minDeposit)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Release at</dt><dd>{formatNaira(inst.pricing.releaseThreshold)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted">The FAGDAN installment price is the outright price plus 10%. The vehicle is released only after at least 90% has been paid and verified. FAGDAN is not a bank or licensed lender. <Link href="/legal/installment-terms" className="font-semibold text-brand underline">Read the terms</Link>.</p>
            </div>
          )}

          <form action={requestTestDrive} className="card space-y-3 p-5">
            <h2 className="font-display text-base font-bold text-navy">Book a test drive</h2>
            <input type="hidden" name="productId" value={p.id} />
            <div><label className="label" htmlFor="td-name">Your name</label><input id="td-name" name="name" required className="input" autoComplete="name" /></div>
            <div><label className="label" htmlFor="td-phone">Phone</label><input id="td-phone" name="phone" required className="input" inputMode="tel" autoComplete="tel" /></div>
            <div><label className="label" htmlFor="td-when">Preferred date and time</label><input id="td-when" name="preferredAt" type="datetime-local" required className="input" /></div>
            <button className="btn-dark w-full">Request test drive</button>
          </form>
        </aside>
      </div>

      {(fit.length > 0 || universal.length > 0) && (
        <section className="mt-12">
          <h2 className="section-title">Accessories for your {v.makeName} {v.modelName}</h2>
          {fit.length === 0 && <p className="mt-1 text-sm text-muted">No model-specific items yet. These universal items suit most cars; please confirm fit before ordering.</p>}
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {fit.map((a) => <div key={a.id}><ProductCard p={a} href={`/shop/${a.slug}`} /><p className="mt-1 text-xs font-semibold text-ok">Fits your {v.modelName}</p></div>)}
            {universal.map((a) => <div key={a.id}><ProductCard p={a} href={`/shop/${a.slug}`} /><p className="mt-1 text-xs text-warn">Universal: confirm fit</p></div>)}
          </div>
        </section>
      )}
    </div>
  );
}
