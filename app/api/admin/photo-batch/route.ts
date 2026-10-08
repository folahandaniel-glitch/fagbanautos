import { getSessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { findPhotosBatch, photosWaiting } from "@/lib/images/batch";
import { getBraveKey } from "@/lib/images/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = ["products:edit", "vehicles:edit", "inventory:edit"];

async function staff() {
  const user = await getSessionUser();
  if (!user || user.kind !== "STAFF" || !ALLOWED.some((p) => user.permissions.has(p))) return null;
  return user;
}

/** How many listings are waiting for a real photo (and whether search is configured). */
export async function GET() {
  if (!(await staff())) return Response.json({ error: "Not allowed." }, { status: 403 });
  return Response.json({ remaining: await photosWaiting(), searchReady: !!(await getBraveKey()) });
}

/** Process the next few waiting listings. The admin page calls this repeatedly and shows a progress bar. */
export async function POST() {
  const user = await staff();
  if (!user) return Response.json({ error: "Not allowed." }, { status: 403 });
  if (!(await rateLimit("photo-batch", 120, 600))) return Response.json({ error: "Please wait a few minutes before searching again." }, { status: 429 });
  const r = await findPhotosBatch(4, 45_000);
  if (r.processed > 0) await audit({ actorId: user.id, action: "photos.batch", targetType: "Product", targetId: "batch", after: r });
  return Response.json(r);
}
