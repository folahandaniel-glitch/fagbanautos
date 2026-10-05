import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { renderDocument } from "@/lib/pdf/render";
import {
  buildBooking, buildInstallmentStatement, buildInvoice, buildPaymentStatement, buildReceipt, buildReservation, buildSwap, buildTradeIn, DocumentError,
} from "@/lib/documents/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Subject = { customerId: string; orderId?: string };

const staffCan = (u: SessionUser, ...perms: string[]) => u.kind === "STAFF" && perms.some((p) => u.permissions.has(p));
const orderDocs = ["invoice", "quotation", "statement", "installment", "reservation"] as const;

async function findOrder(ref: string) {
  return db.order.findFirst({ where: { OR: [{ id: ref }, { orderNumber: ref }] }, select: { id: true, customerId: true, orderNumber: true } });
}

/**
 * Authenticated PDF documents. Customers can only fetch documents about their own records;
 * staff need the matching permission. Anything else is a 404 (we do not reveal that a record exists).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ type: string; ref: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { type, ref } = await ctx.params;
  const notFound = () => new Response("Not found", { status: 404 });
  const allowed = (s: Subject, ...perms: string[]) => staffCan(user, ...perms) || (user.kind === "CUSTOMER" && !!user.customerId && s.customerId === user.customerId);

  try {
    let pdfModel;
    if ((orderDocs as readonly string[]).includes(type)) {
      const o = await findOrder(ref);
      if (!o || !allowed({ customerId: o.customerId }, "orders:view", "documents:view")) return notFound();
      pdfModel = type === "invoice" ? await buildInvoice(o.id, "INVOICE") : type === "quotation" ? await buildInvoice(o.id, "QUOTATION")
        : type === "statement" ? await buildPaymentStatement(o.id) : type === "installment" ? await buildInstallmentStatement(o.id) : await buildReservation(o.id);
    } else if (type === "receipt") {
      const p = await db.payment.findUnique({ where: { id: ref }, include: { order: { select: { customerId: true } } } });
      if (!p || !allowed({ customerId: p.order.customerId }, "payments:view", "documents:view")) return notFound();
      pdfModel = await buildReceipt(p.id);
    } else if (type === "trade-in") {
      const t = await db.tradeIn.findUnique({ where: { id: ref }, select: { id: true, customerId: true } });
      if (!t || !allowed(t, "tradeins:view", "documents:view")) return notFound();
      pdfModel = await buildTradeIn(t.id);
    } else if (type === "swap") {
      const s = await db.swapRequest.findUnique({ where: { id: ref }, select: { id: true, customerId: true } });
      if (!s || !allowed(s, "swaps:view", "documents:view")) return notFound();
      pdfModel = await buildSwap(s.id);
    } else if (type === "booking") {
      const b = await db.serviceBooking.findUnique({ where: { id: ref }, select: { id: true, customerId: true } });
      if (!b || !allowed(b, "bookings:view")) return notFound();
      pdfModel = await buildBooking(b.id);
    } else return notFound();

    const bytes = await renderDocument(pdfModel);
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdfModel.number}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof DocumentError) return new Response(e.message, { status: 409 });
    console.error("[documents]", e);
    return new Response("Could not generate the document.", { status: 500 });
  }
}
