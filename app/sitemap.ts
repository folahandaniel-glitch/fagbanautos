import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSite();
  const base = site.appUrl;
  const [products, services, pages] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, type: true, updatedAt: true }, take: 5000 }),
    db.service.findMany({ where: { isActive: true }, select: { slug: true } }),
    db.cmsPage.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  const statics = ["", "/cars", "/parts", "/accessories", "/technology", "/auto-care", "/finance", "/imports", "/sell-or-swap", "/about", "/contact", "/faq"].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.8 }));
  return [
    ...statics,
    ...products.map((p) => ({ url: `${base}${p.type === "VEHICLE" ? "/cars/" : "/shop/"}${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
    ...services.map((s) => ({ url: `${base}/auto-care/${s.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...pages.map((p) => ({ url: `${base}/legal/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
