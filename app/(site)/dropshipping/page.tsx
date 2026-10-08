import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getContent } from "@/lib/content";
import { ProductCard } from "@/components/ui/cards";

export const metadata: Metadata = {
  title: "Dropshipping: partner goods delivered to you",
  description: "Order goods supplied by our trusted partner companies through FAGDAN. We take the order and payment, the partner ships, and we stand behind the sale.",
  alternates: { canonical: "/dropshipping" },
};
export const dynamic = "force-dynamic";

const STEPS = [
  ["You order here", "Browse partner goods and pay through our secure checkout, just like any other product."],
  ["Our partner prepares it", "We place the order with the supplying company as soon as your payment is confirmed."],
  ["Delivered to you", "The goods are shipped to your address or to our office for collection. Track the order in your account."],
  ["We stand behind it", "Your receipt, warranty and after-sales support come from FAGDAN."],
];

export default async function Dropshipping() {
  const [me, c] = await Promise.all([getSessionUser(), getContent()]);
  const where = { fulfilment: "DROPSHIP", status: "ACTIVE" as const };
  const products = me ? await db.product.findMany({ where, orderBy: { createdAt: "desc" }, take: 60, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true, brand: true } }) : [];
  const total = me ? products.length : await db.product.count({ where });
  return (
    <div className="container-x py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-brand to-navy p-7 text-white sm:p-12">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-5xl">{c.t("pages.dropship.title")}</h1>
          <p className="mt-4 text-lg text-white/90">{c.t("pages.dropship.intro")}</p>
          {!me && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/account/login?next=/dropshipping" className="btn-gold">Sign in to view the goods</Link>
              <Link href="/account/register?next=/dropshipping" className="btn-ghost !border-white/30 !bg-white/10 !text-white">Create a free account</Link>
            </div>
          )}
          <p className="mt-4 text-sm text-white/70">{total > 0 ? `${total} partner product${total === 1 ? "" : "s"} ${me ? "available" : "available to signed-in customers"}.` : "Partner products are added regularly."}</p>
        </div>
      </section>

      {me && products.length > 0 && (
        <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard p={p as never} href={p.vehicle ? `/cars/${p.slug}` : `/shop/${p.slug}`} />
              {(p.dropshipPartner || p.dropshipLeadDays) && <p className="mt-1 px-1 text-xs text-muted">{p.dropshipPartner ? `Supplied by ${p.dropshipPartner}. ` : ""}{p.dropshipLeadDays ? `Delivery in about ${p.dropshipLeadDays} day${p.dropshipLeadDays === 1 ? "" : "s"}.` : ""}</p>}
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="font-display text-2xl font-extrabold text-navy">How it works</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 font-display font-extrabold text-brand">{i + 1}</span>
              <h3 className="mt-3 font-display font-bold text-navy">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
