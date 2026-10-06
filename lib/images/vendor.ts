import { fetchPublicHtml, robotsAllows } from "./safe-fetch";

export interface VendorPhoto { url: string; credit: string; sourceUrl: string }

const abs = (href: string, base: URL) => {
  try { const u = new URL(href.replace(/&amp;/g, "&"), base); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
};
const BAD = /logo|sprite|icon|favicon|avatar|banner|placeholder|pixel|tracking|badge|payment|social|flag|loader|spinner/i;

/** Pulls picture candidates from one product page: Open Graph / Twitter image, JSON-LD product images, then large-looking img tags. */
export function extractImages(html: string, base: URL): string[] {
  const out: string[] = [];
  const add = (v: string | undefined | null) => { const u = v ? abs(v, base) : null; if (u && !BAD.test(u) && !out.includes(u)) out.push(u); };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>/gi)) add(/content=["']([^"']+)["']/i.exec(m[0])?.[1]);
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === "object") {
          const o = n as Record<string, unknown>;
          const img = o.image;
          if (typeof img === "string") add(img);
          else if (Array.isArray(img)) img.forEach((i) => add(typeof i === "string" ? i : (i as { url?: string })?.url));
          else if (img && typeof img === "object") add((img as { url?: string }).url);
          Object.values(o).forEach(walk);
        }
      };
      walk(JSON.parse(m[1]));
    } catch { /* ignore malformed JSON-LD */ }
  }
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const w = Number(/\bwidth=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    if (w && w < 300) continue;
    const src = /\bdata-(?:zoom-image|large|src|original)=["']([^"']+)["']/i.exec(tag)?.[1] ?? /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (src && /\.(jpe?g|png|webp)(\?|$)/i.test(src)) add(src);
  }
  return out;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2);

/** Looks for a product link on a vendor site's own search page whose text or address contains the product's key words. */
async function findProductPage(site: URL, name: string, brand: string): Promise<URL | null> {
  const stripped = brand ? name.replace(new RegExp(brand, "i"), "").trim() : name;
  const q = encodeURIComponent(stripped || name);
  const key = words(name).filter((w) => !words(brand).includes(w));
  if (key.length === 0) return null;
  for (const path of [`/search?q=${q}`, `/?s=${q}&post_type=product`, `/catalogsearch/result/?q=${q}`, `/search/?q=${q}`]) {
    try {
      const { html, finalUrl } = await fetchPublicHtml(new URL(path, site.origin).toString());
      let best: { href: string; score: number } | null = null;
      for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
        const href = abs(m[1], finalUrl);
        if (!href || new URL(href).origin !== site.origin) continue;
        const hay = `${decodeURIComponent(new URL(href).pathname)} ${m[2].replace(/<[^>]+>/g, " ")}`.toLowerCase();
        const score = key.filter((w) => hay.includes(w)).length;
        if (score >= Math.max(1, Math.ceil(key.length * 0.6)) && (!best || score > best.score)) best = { href, score };
      }
      if (best) return new URL(best.href);
    } catch { /* try the next pattern */ }
  }
  return null;
}

/**
 * Finds product pictures on the vendor's own website: from an exact product-page link if the admin gave one,
 * otherwise by searching the brand's official site. Respects robots.txt. Returns candidate image URLs with credit text.
 */
export async function findVendorPhotos(opts: { pageUrl?: string | null; siteUrl?: string | null; name: string; brand?: string | null; want: number }): Promise<VendorPhoto[]> {
  const brand = opts.brand ?? "";
  try {
    let page: URL | null = null;
    if (opts.pageUrl) page = new URL(opts.pageUrl);
    else if (opts.siteUrl) {
      const site = new URL(/^https?:\/\//i.test(opts.siteUrl) ? opts.siteUrl : `https://${opts.siteUrl}`);
      if (!(await robotsAllows(site.origin))) return [];
      page = await findProductPage(site, opts.name, brand);
    }
    if (!page || !(await robotsAllows(page.origin))) return [];
    const { html, finalUrl } = await fetchPublicHtml(page.toString());
    const host = finalUrl.hostname.replace(/^www\./, "");
    return extractImages(html, finalUrl).slice(0, opts.want + 4).map((url) => ({ url, sourceUrl: finalUrl.toString(), credit: `Image from ${brand ? `${brand} official website` : "the vendor website"} (${host}).` }));
  } catch (e) {
    console.warn("[vendor-photos]", (e as Error).message);
    return [];
  }
}
