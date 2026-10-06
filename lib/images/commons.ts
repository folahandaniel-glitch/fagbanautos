/**
 * Finds real, freely licensed photographs on Wikimedia Commons and returns them with the attribution the
 * licence requires. Only licences that allow commercial use are accepted (CC0, public domain, CC BY, CC BY-SA).
 * Non-commercial (NC) and no-derivatives (ND) files are never used.
 */
export interface FoundPhoto {
  url: string; // 1600px-wide rendition
  width: number;
  height: number;
  title: string;
  credit: string; // "Author, CC BY-SA 4.0, via Wikimedia Commons"
  sourceUrl: string;
  license: string;
  score: number;
}

const UA = "FagbanAutosBot/1.0 (https://fagbanautos.vercel.app; folahandaniel@gmail.com)";
const OK_LICENSE = /^(cc0|public domain|pd\b|cc by(-sa)? \d)/i;
const BAD_WORDS = /(logo|badge|emblem|diagram|drawing|map\b|brochure|poster|screenshot|advertis|sketch|\.svg|\btoys?\b|model car|scale model|lego|hot wheels|crash|accident|wreck|junkyard|scrap)/i;
const EXTERIOR = /(front|rear|side|exterior|profile|three[- ]quarter|\bview\b|studio)/i;
const INTERIOR = /(interior|dashboard|cockpit|seats?\b|steering|console|engine bay|trunk|boot\b|wheel\b|headlight|taillight)/i;

const strip = (s: string | undefined) => (s ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();

interface Page { title: string; imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[] }

export async function searchCommons(query: string, want = 4, opts: { vehicle?: boolean; fetchImpl?: typeof fetch; mustMatch?: string[] } = {}): Promise<FoundPhoto[]> {
  const f = opts.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "30",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600",
  });
  const res = await f(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Commons search failed (${res.status})`);
  const json = (await res.json()) as { query?: { pages?: Record<string, Page> } };
  const pages = Object.values(json.query?.pages ?? {});
  const out: FoundPhoto[] = [];
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (!i || !i.thumburl || !/^image\/(jpeg|png)$/.test(i.mime)) continue;
    const meta = i.extmetadata ?? {};
    const license = strip(meta.LicenseShortName?.value);
    if (!OK_LICENSE.test(license) || /nc|nd/i.test(strip(meta.License?.value ?? "").replace(/cc-by-sa/i, ""))) continue;
    const title = p.title.replace(/^File:/, "");
    if (BAD_WORDS.test(title)) continue;
    // Every key word must appear in the file title (plural-tolerant), so a "seat cover" search never returns a car interior.
    const must = (opts.mustMatch ?? []).map((w) => w.toLowerCase().replace(/s$/, "")).filter((w) => w.length > 2);
    const lowerTitle = title.toLowerCase();
    if (must.length && !must.every((w) => lowerTitle.includes(w))) continue;
    const w = i.thumbwidth ?? i.width, h = i.thumbheight ?? i.height;
    if (i.width < 1000 || i.height < 600) continue;
    const ratio = i.width / i.height;
    if (ratio < 1.15 || ratio > 2.4) continue; // landscape only: fits the card and gallery layouts
    let score = 0;
    if (opts.vehicle) { if (EXTERIOR.test(title)) score += 3; if (INTERIOR.test(title)) score -= 2; }
    score += Math.min(2, i.width / 2500);
    if (/cc0|public domain|pd/i.test(license)) score += 0.5;
    const artist = strip(meta.Artist?.value) || "Unknown author";
    out.push({
      url: i.thumburl, width: w, height: h, title, license, score,
      credit: /cc0|public domain|pd\b/i.test(license) ? `${artist}, ${license}, via Wikimedia Commons` : `${artist.slice(0, 80)}, ${license}, via Wikimedia Commons`,
      sourceUrl: i.descriptionurl,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, want);
}

export async function downloadImage(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !/(^|\.)wikimedia\.org$/.test(u.hostname)) throw new Error("Only Wikimedia image URLs may be downloaded automatically.");
  const res = await fetchImpl(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 12 * 1024 * 1024) throw new Error("Image too large");
  return buf;
}
