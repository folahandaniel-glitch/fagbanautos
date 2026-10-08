import { db } from "../db";
import { decryptSecret } from "../crypto";

/**
 * Real product photos through the Brave Search image API, official manufacturer websites first.
 * Only called from admin actions, the batch route and the daily cron, never while a customer loads a page.
 */

/** Official sites per brand (lower-case brand name to domains). Extend freely: unknown brands still work, they just have no "official" boost. */
export const VENDOR_DOMAINS: Record<string, string[]> = {
  toyota: ["toyota.com", "toyota.co.uk", "toyota-europe.com"], lexus: ["lexus.com", "lexus.co.uk"], honda: ["honda.com", "automobiles.honda.com", "hondanews.com"], nissan: ["nissanusa.com", "nissan.co.uk", "nissan-global.com"],
  hyundai: ["hyundai.com", "hyundainews.com"], kia: ["kia.com", "kiamedia.com"], ford: ["ford.com", "media.ford.com"], mercedes: ["mercedes-benz.com", "mbusa.com", "media.mercedes-benz.com"], "mercedes-benz": ["mercedes-benz.com", "mbusa.com", "media.mercedes-benz.com"],
  bmw: ["bmw.com", "bmwusa.com", "press.bmwgroup.com"], audi: ["audi.com", "audiusa.com", "audi-mediacenter.com"], volkswagen: ["vw.com", "volkswagen.de", "volkswagen-newsroom.com"], peugeot: ["peugeot.com"], renault: ["renault.com", "group.renault.com"],
  mazda: ["mazdausa.com", "mazda.com"], mitsubishi: ["mitsubishi-motors.com", "mitsubishicars.com"], suzuki: ["suzuki.com", "suzukicycles.com", "globalsuzuki.com"], subaru: ["subaru.com", "subaru-global.com"], isuzu: ["isuzu.com", "isuzu.co.jp"],
  "land rover": ["landrover.com"], jeep: ["jeep.com"], tesla: ["tesla.com"], volvo: ["volvocars.com"], "range rover": ["landrover.com"], innoson: ["innosonvehicles.com"], tata: ["tatamotors.com"], mack: ["macktrucks.com"], man: ["man.eu"],
  bosch: ["bosch.com", "boschaftermarket.com", "bosch-automotive.com"], denso: ["denso.com", "densoaftermarket.com"], ngk: ["ngk.com", "ngksparkplugs.com"], michelin: ["michelin.com", "michelinman.com"], bridgestone: ["bridgestone.com", "bridgestonetire.com"],
  continental: ["continental.com", "continental-tires.com"], goodyear: ["goodyear.com"], pirelli: ["pirelli.com"], dunlop: ["dunlop.com", "dunloptires.com"], hankook: ["hankooktire.com"], yokohama: ["yokohamatire.com", "y-yokohama.com"],
  castrol: ["castrol.com"], mobil: ["mobil.com", "exxonmobil.com"], shell: ["shell.com"], total: ["totalenergies.com"], motul: ["motul.com"], valvoline: ["valvoline.com"],
  pioneer: ["pioneer-car.eu", "pioneerelectronics.com"], kenwood: ["kenwood.com", "kenwoodusa.com"], jvc: ["jvc.com", "jvckenwood.com"], sony: ["sony.com"], jbl: ["jbl.com"], garmin: ["garmin.com"], "3m": ["3m.com"],
  anker: ["anker.com"], baseus: ["baseus.com"], xiaomi: ["mi.com"], "70mai": ["70mai.com"], viofo: ["viofo.com"], michelinman: ["michelinman.com"], varta: ["varta-automotive.com"], exide: ["exide.com"], amaron: ["amaron.com"],
};

export interface PhotoCandidate { imageUrl: string; pageUrl: string; title: string; host: string; width?: number; height?: number; official: boolean }

export class ImageSearchError extends Error {
  constructor(message: string, public retryable: boolean) { super(message); this.name = "ImageSearchError"; }
}

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } };
const onDomain = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));

/** The key comes from the environment, or the encrypted copy a Super Admin saved on the Photo finder page. */
export async function getBraveKey(): Promise<string | null> {
  if (process.env.BRAVE_SEARCH_API_KEY) return process.env.BRAVE_SEARCH_API_KEY;
  const row = await db.setting.findUnique({ where: { key: "images.braveKeyEnc" } });
  const enc = typeof row?.value === "string" ? row.value : "";
  if (!enc) return null;
  try { return decryptSecret(enc); } catch { return null; }
}

/** "Toyota Camry 2021 SE (Foreign Used)" to "Toyota Camry 2021 SE" */
export function searchTerms(name: string, brand?: string | null) {
  const cleaned = name
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(foreign[- ]?used|nigerian[- ]?used|tokunbo|brand[- ]?new|certified|pre[- ]?owned|used|new|grade ?a)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  return brand && !cleaned.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${cleaned}` : cleaned;
}

/** Model tokens are the parts with digits (for example "camry" has none, so years are not model tokens; "d4-s", "h11", "5w30" are). */
export function modelTokens(name: string) {
  const NOT_A_MODEL = [/^\d{1,4}$/, /^\d+(\.\d+)?(l|cc|hp|kw|v|ah|mm|cm|inch|in|k|km|kg|psi|w)$/, /^(19|20)\d{2}$/];
  const tokens = name.toLowerCase().match(/[a-z]*\d[a-z0-9.-]*/g) ?? [];
  return [...new Set(tokens.map((t) => t.replace(/[.-]+$/, "")))].filter((t) => t.length >= 2 && !NOT_A_MODEL.some((re) => re.test(t))).slice(0, 4);
}

let lastCall = 0;
type Raw = { title?: string; url?: string; properties?: { url?: string; width?: number; height?: number }; thumbnail?: { width?: number; height?: number } };

async function brave(query: string): Promise<Raw[]> {
  const key = await getBraveKey();
  if (!key) throw new ImageSearchError("Photo search is not set up yet. Add a Brave Search API key on the Photo finder page.", false);
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "30");
  url.searchParams.set("safesearch", "strict");
  url.searchParams.set("spellcheck", "false");
  const wait = lastCall + 1100 - Date.now(); // the free plan allows one request per second
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  let res: Response;
  try { res = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": key }, signal: AbortSignal.timeout(10_000), cache: "no-store" }); }
  catch (e) { throw new ImageSearchError(`Photo search could not be reached: ${(e as Error).message}`, true); }
  if (res.status === 429) throw new ImageSearchError("The photo search allowance for now is used up. It continues later.", true);
  if (res.status === 401 || res.status === 403) throw new ImageSearchError("The photo search key was rejected. Check the key.", false);
  if (!res.ok) throw new ImageSearchError(`Photo search failed (${res.status}).`, res.status >= 500);
  const body = (await res.json()) as { results?: unknown };
  return Array.isArray(body.results) ? (body.results as Raw[]) : [];
}

/** Best candidates for a product, official manufacturer pages first. A photo must mention the model when the name has one. */
export async function findProductPhotos(p: { name: string; brand?: string | null }, opts: { vendorOnly: boolean }): Promise<PhotoCandidate[]> {
  const terms = searchTerms(p.name, p.brand);
  const domains = p.brand ? (VENDOR_DOMAINS[p.brand.trim().toLowerCase()] ?? []) : [];
  const tokens = modelTokens(terms);
  const words = terms.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const rank = (raw: Raw[]): PhotoCandidate[] =>
    raw.map((r) => {
      const imageUrl = r.properties?.url ?? "";
      const pageUrl = r.url ?? "";
      const title = (r.title ?? "").toLowerCase();
      const width = r.properties?.width ?? r.thumbnail?.width;
      const height = r.properties?.height ?? r.thumbnail?.height;
      const official = domains.length > 0 && (onDomain(hostOf(pageUrl), domains) || onDomain(hostOf(imageUrl), domains));
      const tokenHits = tokens.filter((t) => title.includes(t) || imageUrl.toLowerCase().includes(t)).length;
      const wordHits = words.filter((w) => title.includes(w)).length;
      let score = (official ? 100 : 0) + tokenHits * 25 + wordHits * 4;
      if (width && height) {
        const ratio = width / height;
        if (ratio < 0.5 || ratio > 2.4) score -= 60;
        if (Math.min(width, height) < 300) score -= 40;
      }
      if (/\.(svg|gif)(\?|$)/i.test(imageUrl)) score -= 200;
      if (/logo|icon|banner|sprite|placeholder|avatar/i.test(imageUrl)) score -= 80;
      const relevant = tokens.length ? tokenHits > 0 || wordHits >= Math.min(3, words.length) : wordHits >= Math.min(2, words.length);
      return { c: { imageUrl, pageUrl, title: r.title ?? "", host: hostOf(pageUrl) || hostOf(imageUrl), width, height, official }, score, relevant };
    })
      .filter((x) => x.c.imageUrl.startsWith("https://") && x.relevant && x.score > 0)
      .sort((a, b) => b.score - a.score).map((x) => x.c);

  if (domains.length) {
    const official = rank(await brave(`${terms} site:${domains[0]}`)).filter((c) => c.official);
    if (official.length) return official.slice(0, 5);
  }
  if (opts.vendorOnly && domains.length) return [];
  const any = rank(await brave(`${terms} product photo`));
  return (opts.vendorOnly ? any.filter((c) => c.official) : any).slice(0, 5);
}
