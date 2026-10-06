import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/**
 * Serves locally stored (development) uploads, but only to people allowed to see them:
 * staff with payments:view, or the customer who owns the payment the proof belongs to.
 * Production uses private-by-obscurity blob URLs behind the same ownership checks at the page level.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  // Product photos are public (they are shown on the storefront); every other upload needs an authorised session.
  const publicFile = parts[0] === "products" && parts.length === 2;
  const user = publicFile ? null : await getSessionUser();
  if (!publicFile && !user) return new Response("Unauthorized", { status: 401 });
  if (parts.some((p) => p.includes("..") || p.includes("\\") || p.startsWith("."))) return new Response("Bad request", { status: 400 });
  const rel = parts.join("/");
  const url = `/api/files/${rel}`;
  const allowed =
    publicFile ||
    (user && user.kind === "STAFF" && (user.permissions.has("payments:view") || user.permissions.has("vat:view") || user.permissions.has("tradeins:view") || user.permissions.has("bookings:view"))) ||
    !!(user?.customerId && (await db.payment.findFirst({ where: { proofUrl: url, order: { customerId: user!.customerId! } }, select: { id: true } })));
  if (!allowed) return new Response("Forbidden", { status: 403 });
  const full = path.join(process.cwd(), "uploads", rel);
  if (!full.startsWith(path.join(process.cwd(), "uploads"))) return new Response("Bad request", { status: 400 });
  try {
    const data = await readFile(full);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    return new Response(data, { headers: { "Content-Type": MIME[ext] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": publicFile ? "public, max-age=31536000, immutable" : "private, no-store", "Content-Disposition": "inline" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
