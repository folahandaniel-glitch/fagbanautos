import type { MetadataRoute } from "next";
import { getSite } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSite();
  // While demo data is live, search engines are asked not to index anything.
  if (!site.indexDemo) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/checkout", "/cart", "/account", "/order", "/pay"] }], sitemap: `${site.appUrl}/sitemap.xml` };
}
