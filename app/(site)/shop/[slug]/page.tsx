import { jsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSite, waLink } from "@/lib/site";
import { getContent } from "@/lib/content";
import { ProductGallery } from "@/components/site/ProductGallery";
import { buildQuote } from "@/lib/services/orders";
import { formatNaira } from "@/lib/money";
import { SmartImage } from "@/components/ui/media";
import { ProductCard } from "@/components/ui/cards";
import { addToCart } from "@/app/actions/cart";

export const dynamic = "force-dynamic";

const load = (slug: string) => db.product.findUnique({ where: { slug }, include: { images: { orderBy: { sortOrder: "asc" } }, brand: true, category: true, compat: true } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.shortDescription ?? undefined, alternates: { canonical: `/shop/${p.slug}` } } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p || p.status === "DRAFT" || p.status === "ARCHIVED") notFound();
  if (p.type === "VEHICLE") redirect(`/cars/${p.slug}`);
  const site = await getSite();
  const content = await getContent();
  const canBuy = !p.isDemo || content.flag("catalogue.allowDemoPurchases");
  const available = p.stockOnHand - p.stockReserved;
  const inStock = p.status === "ACTIVE" && (available > 0 || p.allowBackorder);
  const quote = inStock ? await buildQuote({ lines: [{ productId: p.id, quantity: 1 }], mode: "OUTRIGHT" }) : null;
  const related = await db.product.findMany({ where: { categoryId: p.categoryId, id: { not: p.id }, status: "ACTIVE" }, include: { images: { take: 1 } }, take: 4 });
  const universal = p.compat.length === 0 && (p.type === "ACCESSORY" || p.type === "PART" || p.type === "TECHNOLOGY");
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku, mpn: p.partNumber ?? undefined, brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    description: p.description ?? undefined, image: p.images.map((i) => new URL(i.url, site.appUrl).toString()),
    offers: { "@type": "Offer", price: (Number(p.price) - Number(p.discount)) / 100, priceCurrency: "NGN", availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${site.appUrl}/shop/${p.slug}` },
  };
  const rows: [string, string | null | undefined][] = [["Brand", p.brand?.name], ["Category", p.category?.name], ["SKU", p.sku], ["Part number", p.partNumber], ["Type", p.partGrade === "OEM" ? "OEM (genuine)" : p.partGrade === "AFTERMARKET" ? "Aftermarket" : null], ["Origin", p.origin], ["Warranty", p.warranty]];
  return (
    <div className="container-x py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-brand">Home</Link> / <span>{p.category?.name}</span> / <span className="text-ink">{p.name}</span></nav>
      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <ProductGallery images={p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, credit: i.credit, sourceUrl: i.sourceUrl }))} name={p.name} aspect="aspect-[4/3]" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-accent-600">{p.brand?.name}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-navy sm:text-3xl">{p.name}</h1>
          <p className="mt-4 font-display text-3xl font-extrabold text-navy">{formatNaira(Number(p.price) - Number(p.discount))}</p>
          {Number(p.discount) > 0 && <p className="text-sm text-muted line-through">{formatNaira(Number(p.price))}</p>}
          {quote && <p className="mt-1 text-xs text-muted">Includes no VAT yet: VAT {formatNaira(quote.pricing.vatTotal)} is added at checkout, total {formatNaira(quote.pricing.grandTotal)}.</p>}
          <p className={`mt-3 text-sm font-semibold ${inStock ? "text-ok" : "text-danger"}`}>{inStock ? (available > 0 && available <= p.lowStockThreshold ? `Only ${available} left` : "In stock") : "Out of stock"}</p>

          {universal && <p className="mt-4 rounded-xl bg-warn/10 p-3 text-sm text-ink"><strong>Universal fit.</strong> We cannot confirm this item fits every vehicle. Please check dimensions or ask our team on WhatsApp before ordering.</p>}
          {p.compat.length > 0 && (
            <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm"><p className="font-semibold text-navy">Compatible vehicles</p>
              <ul className="mt-1 list-inside list-disc text-muted">{p.compat.map((c) => <li key={c.id}>{c.makeName} {c.modelName ?? "(all models)"} {c.yearFrom ? `${c.yearFrom}${c.yearTo && c.yearTo !== c.yearFrom ? `-${c.yearTo}` : ""}` : ""}</li>)}</ul>
              <p className="mt-2 text-xs text-muted">Check your vehicle&apos;s exact year, engine and trim before ordering. When unsure, <a className="font-semibold text-brand underline" href={waLink(site.phone1, `Does ${p.name} (${p.sku}) fit my car?`)}>ask us</a>.</p></div>
          )}
          {inStock && !canBuy && (
            <div className="mt-5 flex flex-wrap gap-3"><a href={waLink(site.phone1, `Hello FAGDAN, I would like to enquire about ${p.name} (${p.sku}).`)} target="_blank" rel="noopener noreferrer" className="btn-primary">Enquire on WhatsApp</a><Link href="/contact" className="btn-ghost">Request details</Link></div>
          )}
          {inStock && canBuy && (
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <form action={addToCart} className="flex items-end gap-3">
                <input type="hidden" name="productId" value={p.id} />
                <div><label className="label" htmlFor="qty">Quantity</label><input id="qty" name="quantity" type="number" min={1} max={99} defaultValue={1} className="input !w-24" /></div>
                <button className="btn-ghost">Add to cart</button>
              </form>
              <form action={addToCart}><input type="hidden" name="productId" value={p.id} /><input type="hidden" name="buyNow" value="1" /><button className="btn-primary">Buy now</button></form>
              <a href={waLink(site.phone1, `Hello FAGDAN, I want to order ${p.name} (${p.sku}).`)} target="_blank" rel="noopener noreferrer" className="btn-ghost">WhatsApp</a>
            </div>
          )}
          {p.description && <section className="mt-8"><h2 className="font-display text-lg font-bold text-navy">Description</h2><p className="mt-2 text-sm leading-relaxed text-muted">{p.description}</p></section>}
          <dl className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between border-b border-line px-4 py-2.5 text-sm last:border-0"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
        </div>
      </div>
      {related.length > 0 && <section className="mt-12"><h2 className="section-title">Related products</h2><div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} href={`/shop/${r.slug}`} />)}</div></section>}
    </div>
  );
}
