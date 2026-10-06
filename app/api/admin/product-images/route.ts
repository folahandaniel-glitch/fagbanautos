import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { optimiseImage } from "@/lib/images/optimize";
import { addOptimisedUpload } from "@/lib/images/library";
import { storeFile, validateUpload, UploadError, type UploadRule } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The browser already shrinks photos before sending (about 300-800 KB); this is the hard ceiling the server accepts.
const RULE: UploadRule = { maxBytes: 4 * 1024 * 1024, kinds: ["image"] };
const MAX_PER_PRODUCT = 12;

/** Upload one photo for a product. Validates the file, compresses it to WebP (max 1600px), stores it and appends it to the gallery. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.kind !== "STAFF") return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!["products:edit", "vehicles:edit", "inventory:edit"].some((p) => user.permissions.has(p))) return Response.json({ error: "You do not have permission to change photos." }, { status: 403 });
  if (!(await rateLimit("img-upload", 80, 600))) return Response.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const productId = String(form?.get("productId") ?? "");
  const file = form?.get("file");
  if (!form || !productId || !(file instanceof File)) return Response.json({ error: "Missing file." }, { status: 400 });
  const product = await db.product.findUnique({ where: { id: productId }, include: { images: true } });
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
  if (product.images.length >= MAX_PER_PRODUCT + product.images.filter((i) => i.isPlaceholder).length) return Response.json({ error: `A product can have at most ${MAX_PER_PRODUCT} photos.` }, { status: 409 });
  try {
    const v = await validateUpload(file, RULE);
    const opt = await optimiseImage(v.bytes);
    const url = await storeFile(opt.bytes, opt.ext, opt.mime, "products");
    const img = await addOptimisedUpload(productId, { url, width: opt.width, height: opt.height, bytes: opt.bytes.length }, product.name, product.images.every((i) => i.isPlaceholder));
    await audit({ actorId: user.id, action: "product.image_add", targetType: "Product", targetId: productId, after: { via: "upload", kb: Math.round(opt.bytes.length / 1024) } });
    return Response.json({ ok: true, id: img.id, kb: Math.round(opt.bytes.length / 1024), width: opt.width, height: opt.height });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[product-images]", e);
    return Response.json({ error: "That image could not be processed. Try a different JPG, PNG or WebP." }, { status: 422 });
  }
}
