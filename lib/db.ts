import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = db;

/** Convert BigInt kobo columns to plain numbers for UI/JSON. Safe up to NGN 90 trillion. */
export function big(n: bigint | number | null | undefined): number {
  return n == null ? 0 : Number(n);
}
