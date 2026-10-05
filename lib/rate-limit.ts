import { headers } from "next/headers";

/**
 * Fixed-window rate limiter keyed by client IP + bucket.
 * Uses Upstash Redis (REST) when configured; otherwise an in-memory map (single instance; fine for development,
 * set the Upstash variables in production so limits hold across serverless instances).
 */
const mem = new Map<string, { n: number; reset: number }>();

async function clientId(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  } catch {
    return "local";
  }
}

export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const id = `${bucket}:${await clientId()}`;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const key = `rl:${id}:${Math.floor(Date.now() / (windowSec * 1000))}`;
      const res = await fetch(`${url}/pipeline`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSec]]), cache: "no-store",
      });
      const out = (await res.json()) as { result: number }[];
      return out[0].result <= limit;
    } catch (err) {
      console.error("[rate-limit] Upstash unavailable, falling back to memory", err);
    }
  }
  const now = Date.now();
  const cur = mem.get(id);
  if (!cur || cur.reset < now) { mem.set(id, { n: 1, reset: now + windowSec * 1000 }); return true; }
  cur.n++;
  return cur.n <= limit;
}
