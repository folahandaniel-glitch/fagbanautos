import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export interface AuditInput {
  actorId?: string | null;
  action: string; // e.g. "payment.verify", "settings.vat.update"
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined ? undefined : (JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))) as Prisma.InputJsonValue);

/** Append-only audit trail. Sensitive actions must not proceed unaudited, so failures propagate. */
export async function audit(input: AuditInput, tx: Prisma.TransactionClient | typeof db = db): Promise<void> {
  let ip: string | undefined;
  let userAgent: string | undefined;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
    userAgent = h.get("user-agent") ?? undefined;
  } catch {
    // outside a request scope (seed scripts, tests): no request metadata available
  }
  try {
    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: json(input.before),
        after: json(input.after),
        reason: input.reason,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", input.action, err);
    throw err;
  }
}
