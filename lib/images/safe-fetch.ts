import { lookup } from "node:dns/promises";
import net from "node:net";

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((r) => r.test(ip));
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

/**
 * Downloads an image from a public https URL (admin "add by link"). Protects the server from SSRF:
 * https only, the hostname must resolve to public addresses, redirects are refused, size and type are capped.
 */
export async function fetchPublicImage(rawUrl: string, maxBytes = 12 * 1024 * 1024): Promise<Buffer> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("That is not a valid link."); }
  if (url.protocol !== "https:") throw new Error("Only https links are accepted.");
  if (url.username || url.password) throw new Error("Links with credentials are not accepted.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) ? isPrivateIp(host) : false) throw new Error("That address is not allowed.");
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new Error("We could not find that website.");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address is not allowed.");
  const res = await fetch(url, { redirect: "error", headers: { "User-Agent": "FagbanAutosBot/1.0", Accept: "image/jpeg,image/png,image/webp,image/*;q=0.5" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`The image could not be downloaded (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp|gif|avif)/i.test(type)) throw new Error("That link is not a JPG, PNG or WebP image.");
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new Error("That image is too large.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("That image is too large.");
  return buf;
}
