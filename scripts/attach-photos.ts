import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { autoPhotosForProduct } from "../lib/images/library";

/** Adds licensed, compressed photos to listings that only have placeholders. Safe to re-run; use LIMIT to do it in batches. */
const db = new PrismaClient();
(async () => {
  const limit = Number(process.env.LIMIT ?? 1000);
  const todo = await db.product.findMany({ where: { needsImage: true, status: { not: "ARCHIVED" }, OR: [{ images: { none: {} } }, { images: { every: { isPlaceholder: true } } }] }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true, name: true } });
  console.log(`${todo.length} listings to photograph`);
  let ok = 0;
  for (const p of todo) {
    try {
      const n = await autoPhotosForProduct(p.id, 3);
      if (n) ok++;
      console.log(`${n ? "+" : "-"} ${p.name} (${n})`);
    } catch (e) { console.warn("fail", p.name, (e as Error).message); }
  }
  console.log(`photographed ${ok} of ${todo.length}`);
})().finally(() => db.$disconnect());
