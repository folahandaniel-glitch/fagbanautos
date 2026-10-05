import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { buildTemplate, exportWorkbook } from "@/lib/services/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const k = (n: bigint | number) => Number(n) / 100;
const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 19).replace("T", " ") : "");

/** Each export needs its own permission and is audited. Money columns are in Naira. */
const EXPORTS: Record<string, { perm: string[]; title: string; build: () => Promise<{ cols: { header: string; key: string; width?: number }[]; rows: Record<string, unknown>[] }> }> = {
  inventory: { perm: ["inventory:export", "vehicles:export", "products:export"], title: "Inventory", build: async () => {
    const items = await db.product.findMany({ include: { vehicle: true, category: true, brand: true, division: true }, orderBy: { sku: "asc" } });
    return { cols: ["SKU", "Name", "Type", "Division", "Category", "Brand", "Status", "Price", "Discount", "On hand", "Reserved", "Sold", "VIN", "Stock number", "Inventory ID", "Year", "Condition", "Demo"].map((h) => ({ header: h, key: h })),
      rows: items.map((p) => ({ SKU: p.sku, Name: p.name, Type: p.type, Division: p.division.slug, Category: p.category?.name, Brand: p.brand?.name, Status: p.status, Price: k(p.price), Discount: k(p.discount), "On hand": p.stockOnHand, Reserved: p.stockReserved, Sold: p.stockSold, VIN: p.vehicle?.vin, "Stock number": p.vehicle?.stockNumber, "Inventory ID": p.vehicle?.inventoryId, Year: p.vehicle?.year, Condition: p.condition, Demo: p.isDemo ? "YES" : "" })) };
  } },
  orders: { perm: ["orders:export"], title: "Orders", build: async () => {
    const o = await db.order.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 20000 });
    return { cols: ["Order", "Date", "Customer", "Email", "Mode", "Status", "Subtotal", "Discount", "Uplift", "VAT", "Charges", "Trade-in", "Total", "Paid", "Release"].map((h) => ({ header: h, key: h })),
      rows: o.map((x) => ({ Order: x.orderNumber, Date: d(x.createdAt), Customer: x.customer.name, Email: x.customer.email, Mode: x.paymentMode, Status: x.status, Subtotal: k(x.subtotal), Discount: k(x.discountTotal), Uplift: k(x.upliftTotal), VAT: k(x.vatTotal), Charges: k(x.chargesTotal), "Trade-in": k(x.tradeInCredit), Total: k(x.grandTotal), Paid: k(x.amountPaid), Release: x.releaseState })) };
  } },
  customers: { perm: ["customers:view"], title: "Customers", build: async () => {
    const c = await db.customer.findMany({ include: { _count: { select: { orders: true } } }, orderBy: { createdAt: "desc" }, take: 50000 });
    return { cols: ["Name", "Email", "Phone", "City", "State", "KYC", "Orders", "Created"].map((h) => ({ header: h, key: h })), rows: c.map((x) => ({ Name: x.name, Email: x.email, Phone: x.phone, City: x.city, State: x.state, KYC: x.kycStatus, Orders: x._count.orders, Created: d(x.createdAt) })) };
  } },
  payments: { perm: ["payments:export"], title: "Payments", build: async () => {
    const p = await db.payment.findMany({ include: { order: { include: { customer: true } } }, orderBy: { createdAt: "desc" }, take: 50000 });
    return { cols: ["Date", "Reference", "Gateway ref", "Order", "Customer", "Method", "Status", "Expected", "Paid", "Verified at", "Mismatch"].map((h) => ({ header: h, key: h })),
      rows: p.map((x) => ({ Date: d(x.createdAt), Reference: x.reference, "Gateway ref": x.gatewayReference, Order: x.order.orderNumber, Customer: x.order.customer.name, Method: x.method, Status: x.status, Expected: k(x.expectedAmount), Paid: k(x.paidAmount), "Verified at": d(x.verifiedAt), Mismatch: x.status === "SUCCESS" && x.paidAmount !== x.expectedAmount ? "YES" : "" })) };
  } },
  vat: { perm: ["vat:export"], title: "VAT", build: async () => {
    const o = await db.order.findMany({ where: { status: { not: "CANCELLED" } }, include: { customer: true, vatRecords: true, items: { include: { product: { include: { category: true } } } } }, orderBy: { createdAt: "desc" }, take: 20000 });
    return { cols: ["Order", "Date", "Customer", "VAT on?", "VAT rate %", "VAT amount", "VAT exempted", "Exemption status", "Category", "Total"].map((h) => ({ header: h, key: h })),
      rows: o.map((x) => ({ Order: x.orderNumber, Date: d(x.createdAt), Customer: x.customer.name, "VAT on?": x.vatEnabled ? "YES" : "NO", "VAT rate %": x.vatRateBps / 100, "VAT amount": k(x.vatTotal), "VAT exempted": k(x.vatRecords.reduce((a, r) => a + r.vatRemoved, 0n)), "Exemption status": x.vatExemptionStatus, Category: [...new Set(x.items.map((i) => i.product.category?.name ?? i.product.type))].join(", "), Total: k(x.grandTotal) })) };
  } },
  installments: { perm: ["installments:view", "payments:export"], title: "Installments", build: async () => {
    const o = await db.order.findMany({ where: { paymentMode: "INSTALLMENT" }, include: { customer: true, installment: true }, orderBy: { createdAt: "desc" } });
    return { cols: ["Order", "Customer", "Outright", "Installment price", "Uplift %", "Total", "Paid", "Balance", "Threshold", "Release", "Status"].map((h) => ({ header: h, key: h })),
      rows: o.map((x) => ({ Order: x.orderNumber, Customer: x.customer.name, Outright: k(x.installment?.outrightPrice ?? 0n), "Installment price": k(x.installment?.installmentPrice ?? 0n), "Uplift %": (x.installment?.upliftBps ?? 0) / 100, Total: k(x.grandTotal), Paid: k(x.amountPaid), Balance: k(x.grandTotal - x.tradeInCredit - x.amountPaid), Threshold: k(x.releaseThreshold), Release: x.releaseState, Status: x.status })) };
  } },
  sales: { perm: ["reports:export", "orders:export"], title: "Sales", build: async () => {
    const i = await db.orderItem.findMany({ where: { order: { status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } }, include: { order: true, product: true }, take: 50000 });
    return { cols: ["Order", "Date", "SKU", "Item", "Type", "Qty", "Unit price", "Discount", "VAT", "Line total"].map((h) => ({ header: h, key: h })), rows: i.map((x) => ({ Order: x.order.orderNumber, Date: d(x.order.createdAt), SKU: x.sku, Item: x.name, Type: x.product.type, Qty: x.quantity, "Unit price": k(x.unitPrice), Discount: k(x.discount), VAT: k(x.vat), "Line total": k(x.lineTotal) })) };
  } },
  services: { perm: ["bookings:view"], title: "Service bookings", build: async () => {
    const b = await db.serviceBooking.findMany({ include: { service: true, customer: true }, orderBy: { slotStart: "desc" } });
    return { cols: ["When", "Service", "Customer", "Vehicle", "Location", "Status"].map((h) => ({ header: h, key: h })), rows: b.map((x) => ({ When: d(x.slotStart), Service: x.service.name, Customer: x.customer.name, Vehicle: x.vehicleInfo, Location: x.location, Status: x.status })) };
  } },
  tradeins: { perm: ["tradeins:view"], title: "Trade-ins", build: async () => {
    const t = await db.tradeIn.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" } });
    return { cols: ["Date", "Customer", "Vehicle", "Mileage", "Valuation", "Status"].map((h) => ({ header: h, key: h })), rows: t.map((x) => ({ Date: d(x.createdAt), Customer: x.customer.name, Vehicle: `${x.year} ${x.make} ${x.model}`, Mileage: x.mileageKm, Valuation: x.valuation ? k(x.valuation) : "", Status: x.status })) };
  } },
  swaps: { perm: ["swaps:view"], title: "Swaps", build: async () => {
    const t = await db.swapRequest.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" } });
    return { cols: ["Date", "Customer", "Own vehicle", "Cash difference", "Status"].map((h) => ({ header: h, key: h })), rows: t.map((x) => ({ Date: d(x.createdAt), Customer: x.customer.name, "Own vehicle": x.ownVehicle, "Cash difference": x.cashDifference ? k(x.cashDifference) : "", Status: x.status })) };
  } },
  imports: { perm: ["imports:view"], title: "Imports", build: async () => {
    const c = await db.importCase.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" } });
    return { cols: ["Case", "Date", "Customer", "Vehicle", "Country", "Budget", "Status"].map((h) => ({ header: h, key: h })), rows: c.map((x) => ({ Case: x.caseNumber, Date: d(x.createdAt), Customer: x.customer.name, Vehicle: `${x.year ?? ""} ${x.make} ${x.model}`, Country: x.country, Budget: x.budget ? k(x.budget) : "", Status: x.status })) };
  } },
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const user = await getSessionUser();
  if (!user || user.kind !== "STAFF") return new Response("Unauthorized", { status: 401 });
  const { kind } = await ctx.params;
  if (kind === "template") {
    if (!["inventory:import", "vehicles:import", "products:import"].some((p) => user.permissions.has(p))) return new Response("Forbidden", { status: 403 });
    return new Response(new Uint8Array(await buildTemplate()), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="fagdan-inventory-template.xlsx"', "Cache-Control": "no-store" } });
  }
  const def = EXPORTS[kind];
  if (!def) return new Response("Not found", { status: 404 });
  if (!def.perm.some((p) => user.permissions.has(p))) return new Response("Forbidden", { status: 403 });
  const { cols, rows } = await def.build();
  await audit({ actorId: user.id, action: "export", targetType: "Export", targetId: kind, after: { rows: rows.length } });
  const buf = await exportWorkbook(def.title, cols, rows);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="fagdan-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
}
