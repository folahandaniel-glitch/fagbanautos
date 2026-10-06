import { lookup } from "node:dns/promises";
import net from "node:net";

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((r) => r.test(ip));
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new Error("Only https links are accepted.");
  if (url.username || url.password) throw new Error("Links with credentials are not accepted.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) ? isPrivateIp(host) : false) throw new Error("That address is not allowed.");
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error("We could not find that website.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address is not allowed.");
}

export const BOT_UA = "FagbanAutosBot/1.0 (+product photo lookup)";

/**
 * GET a public https URL safely (SSRF protected): https only, hostname must resolve to public addresses,
 * every redirect hop is re-validated (max 3), and the body is size-capped.
 */
export async function safeGet(rawUrl: string, opts: { accept: string; maxBytes: number; timeoutMs?: number }): Promise<{ res: Response; body: Buffer; finalUrl: URL }> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("That is not a valid link."); }
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": BOT_UA, Accept: opts.accept }, signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The link could not be opened (${res.status}).`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > opts.maxBytes) throw new Error("That file is too large.");
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > opts.maxBytes) throw new Error("That file is too large.");
    return { res, body, finalUrl: url };
  }
  throw new Error("Too many redirects.");
}

/** Downloads an image from a public https URL (admin "add by link" and the vendor photo finder). */
export async function fetchPublicImage(rawUrl: string, maxBytes = 12 * 1024 * 1024): Promise<Buffer> {
  const { res, body } = await safeGet(rawUrl, { accept: "image/jpeg,image/png,image/webp,image/*;q=0.5", maxBytes });
  if (!/^image\/(jpeg|png|webp|gif|avif)/i.test(res.headers.get("content-type") ?? "")) throw new Error("That link is not a JPG, PNG or WebP image.");
  return body;
}

export async function fetchPublicHtml(rawUrl: string): Promise<{ html: string; finalUrl: URL }> {
  const { res, body, finalUrl } = await safeGet(rawUrl, { accept: "text/html,application/xhtml+xml", maxBytes: 3 * 1024 * 1024, timeoutMs: 12_000 });
  if (!/html|xml/i.test(res.headers.get("content-type") ?? "")) throw new Error("That link is not a web page.");
  return { html: body.toString("utf8"), finalUrl };
}

/** True unless the site's robots.txt disallows everything for all bots. */
export async function robotsAllows(origin: string): Promise<boolean> {
  try {
    const { body } = await safeGet(new URL("/robots.txt", origin).toString(), { accept: "text/plain", maxBytes: 200_000, timeoutMs: 6_000 });
    let applies = false;
    for (const raw of body.toString("utf8").split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      const m = /^(user-agent|disallow)\s*:\s*(.*)$/i.exec(line);
      if (!m) continue;
      if (m[1].toLowerCase() === "user-agent") applies = m[2].trim() === "*" || /fagban/i.test(m[2]);
      else if (applies && m[2].trim() === "/") return false;
    }
  } catch { /* no robots.txt: allowed */ }
  return true;
}
