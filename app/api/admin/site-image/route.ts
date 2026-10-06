import { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { optimiseImage } from "@/lib/images/optimize";
import { storeFile, validateUpload, UploadError, type UploadRule } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RULE: UploadRule = { maxBytes: 4 * 1024 * 1024, kinds: ["image"] };

/** Uploads one site picture (carousel slide or team portrait), compresses it to WebP and returns its URL. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.kind !== "STAFF") return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!user.permissions.has("content:edit")) return Response.json({ error: "You do not have permission to change site pictures." }, { status: 403 });
  if (!(await rateLimit("site-image", 60, 600))) return Response.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "portrait" ? "portrait" : "slide";
  if (!(file instanceof File)) return Response.json({ error: "Missing file." }, { status: 400 });
  try {
    const v = await validateUpload(file, RULE);
    const opt = kind === "portrait" ? await optimiseImage(v.bytes, { maxWidth: 900, maxHeight: 1100, quality: 84 }) : await optimiseImage(v.bytes, { maxWidth: 2000, maxHeight: 1100, quality: 80 });
    const url = await storeFile(opt.bytes, opt.ext, opt.mime, "products/site");
    await audit({ actorId: user.id, action: "site.image_upload", targetType: "Site", targetId: kind, after: { kb: Math.round(opt.bytes.length / 1024) } });
    return Response.json({ ok: true, url, kb: Math.round(opt.bytes.length / 1024) });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[site-image]", e);
    return Response.json({ error: "That image could not be processed. Try a different JPG, PNG or WebP." }, { status: 422 });
  }
}
