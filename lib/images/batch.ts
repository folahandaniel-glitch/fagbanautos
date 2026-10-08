import { db } from "../db";
import { autoPhotosForProduct } from "./library";

const RECHECK_DAYS = 7;

/** Listings that only have a generated illustration and have not been searched recently. */
function waiting() {
  const cutoff = new Date(Date.now() - RECHECK_DAYS * 86_400_000);
  return { needsImage: true, status: { not: "ARCHIVED" as const }, OR: [{ photoCheckedAt: null }, { photoCheckedAt: { lt: cutoff } }] };
}

export const photosWaiting = () => db.product.count({ where: waiting() });

/** Looks for real photos for up to `limit` waiting listings, stopping early when `budgetMs` is used. Safe to call repeatedly. */
export async function findPhotosBatch(limit: number, budgetMs = 40_000): Promise<{ processed: number; found: number; remaining: number }> {
  const started = Date.now();
  const rows = await db.product.findMany({ where: waiting(), orderBy: [{ photoCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], take: Math.min(Math.max(limit, 1), 25), select: { id: true } });
  let processed = 0, found = 0;
  for (const r of rows) {
    if (Date.now() - started > budgetMs) break;
    try { if ((await autoPhotosForProduct(r.id, 3)) > 0) found++; }
    catch (e) { console.warn("[photo-batch]", r.id, (e as Error).message); }
    processed++;
  }
  return { processed, found, remaining: await photosWaiting() };
}
