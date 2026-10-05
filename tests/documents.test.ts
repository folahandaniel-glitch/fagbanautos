import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { NextRequest } from "next/server";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/fagdan_test?schema=public";
process.env.DATABASE_URL = TEST_URL;
process.env.DIRECT_URL = TEST_URL;
process.env.SETTINGS_ENCRYPTION_KEY = "documents-test-key-0123456789abc";
process.env.AUTH_SECRET = "documents-test-auth-secret-0123456789-abcdef";

let db: typeof import("../lib/db")["db"];
let S: typeof import("../lib/services/orders");
let D: typeof import("../lib/documents/build");
let R: typeof import("../lib/pdf/render");
let session: typeof import("../lib/auth/session");
let stub: typeof import("./stubs/next-headers");
const suffix = randomUUID().slice(0, 8);
let divisionId = "", custA = "", userA = "", userB = "", staffSales = "", staffInv = "";
const ver: Record<string, number> = {};

async function as(userId: string | null) {
  stub.__reset();
  if (userId) await session.createSession(userId, ver[userId] ?? 0);
}
const call = async (type: string, ref: string) => {
  const { GET } = await import("../app/api/documents/[type]/[ref]/route");
  return GET(new NextRequest(`http://x/api/documents/${type}/${ref}`), { params: Promise.resolve({ type, ref }) });
};

beforeAll(async () => {
  db = (await import("../lib/db")).db;
  S = await import("../lib/services/orders");
  D = await import("../lib/documents/build");
  R = await import("../lib/pdf/render");
  session = await import("../lib/auth/session");
  stub = await import("./stubs/next-headers");
  divisionId = (await db.division.upsert({ where: { slug: "doc-division" }, create: { slug: "doc-division", name: "Doc Division" }, update: {} })).id;
  const roleSales = await db.role.upsert({ where: { key: "SALES_MANAGER" }, create: { key: "SALES_MANAGER", name: "Sales" }, update: {} });
  const roleInv = await db.role.upsert({ where: { key: "INVENTORY_MANAGER" }, create: { key: "INVENTORY_MANAGER", name: "Inventory" }, update: {} });
  const mk = async (email: string, kind: "CUSTOMER" | "STAFF", name: string, roleId?: string) => (await db.user.create({ data: { kind, email: `${email}.${suffix}@example.test`, name, passwordHash: "x", roleId, ...(kind === "CUSTOMER" ? { customer: { create: { name, email: `${email}.${suffix}@example.test`, phone: "+2348000000000", isDemo: true } } } : {}) }, include: { customer: true } }));
  const a = await mk("doca", "CUSTOMER", "Doc Customer A"), b = await mk("docb", "CUSTOMER", "Doc Customer B");
  userA = a.id; userB = b.id; custA = a.customer!.id;
  staffSales = (await mk("docsales", "STAFF", "Sales", roleSales.id)).id; staffInv = (await mk("docinv", "STAFF", "Inv", roleInv.id)).id;
});

async function installmentOrder(customerId: string, priceNaira = 40_000_000) {
  const id = randomUUID().slice(0, 8);
  const car = await db.product.create({ data: { type: "VEHICLE", divisionId, sku: `D-${suffix}-${id}`, slug: `d-${suffix}-${id}`, name: `Doc Car ${id}`, price: BigInt(priceNaira * 100), status: "ACTIVE", stockOnHand: 1, isDemo: true, vehicle: { create: { inventoryId: `DINV-${suffix}-${id}`, stockNumber: `DSTK-${suffix}-${id}`, vin: `DV${randomUUID().replace(/-/g, "").slice(0, 15).toUpperCase()}`, makeName: "Test", modelName: "Doc", year: 2024, bodyType: "Sedan", fuelType: "Petrol", transmission: "Automatic", installmentAvailable: true, isDemo: true } } } });
  const q = await S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: 0 });
  return S.createOrder({ customerId, lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: q.minDeposit, isDemo: true });
}

const flat = (m: import("../lib/pdf/render").DocModel) => JSON.stringify(m.blocks);

describe("PDF renderer", () => {
  const base = { title: "TEST", number: "T-1", date: "5 October 2026", seller: { name: "FAGDAN", lines: ["Line"] }, footerNote: "Footer" };
  it("produces a valid PDF with the Naira sign and survives unsupported characters", async () => {
    const bytes = await R.renderDocument({ ...base, blocks: [{ kind: "paragraph", text: "Total ₦1,250,000.50 — emoji 🚗 and 日本語 and ñ é ü" }, { kind: "banner", tone: "ok", text: "PAID ₦5" }] });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("TEST T-1");
  });
  it("paginates long tables and repeats the page furniture", async () => {
    const rows = Array.from({ length: 140 }, (_, i) => [`Item ${i} with a rather long description that must wrap onto more than one line in the narrow column to test row height`, String(i), "₦1,000.00"]);
    const bytes = await R.renderDocument({ ...base, blocks: [{ kind: "table", columns: [{ header: "Description", width: 50 }, { header: "Qty", width: 10, align: "right" }, { header: "Amount", width: 20, align: "right" }], rows }, { kind: "totals", rows: [{ label: "Total", value: "₦140,000.00", strong: true }] }] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(3);
  });
  it("handles very long unbroken tokens and empty tables", async () => {
    const bytes = await R.renderDocument({ ...base, blocks: [{ kind: "paragraph", text: "X".repeat(600) }, { kind: "table", columns: [{ header: "A", width: 1 }], rows: [], emptyText: "Nothing" }] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("document numbering", () => {
  it("is stable per subject and unique under concurrency", async () => {
    const ids = Array.from({ length: 12 }, () => randomUUID());
    const first = await Promise.all(ids.map((id) => D.getOrCreateDocument("INVOICE", id)));
    expect(new Set(first.map((d) => d.number)).size).toBe(12);
    for (const n of first) expect(n.number).toMatch(/^INV-\d{8}-\d{6}$/);
    const again = await Promise.all(ids.map((id) => D.getOrCreateDocument("INVOICE", id)));
    expect(again.map((d) => d.number)).toEqual(first.map((d) => d.number));
    // the same subject requested 8 times at once still yields exactly one number
    const same = randomUUID();
    const racers = await Promise.all(Array.from({ length: 8 }, () => D.getOrCreateDocument("RECEIPT", same)));
    expect(new Set(racers.map((r) => r.number)).size).toBe(1);
    expect(await db.document.count({ where: { type: "RECEIPT", refId: same } })).toBe(1);
  });
});

describe("document content", () => {
  it("invoice shows the server's figures: installment uplift, VAT, total and payment instructions", async () => {
    const o = await installmentOrder(custA, 50_000_000);
    const inv = await D.buildInvoice(o.id);
    const text = flat(inv);
    expect(inv.title).toBe("TAX INVOICE");
    expect(text).toContain("₦59,125,000.00"); // 55m + 7.5% VAT
    expect(text).toContain("₦4,125,000.00");
    expect(text).toContain("₦5,000,000.00"); // 10% uplift
    expect(text).toContain("the vehicle is released once at least");
    expect(text).toContain("Balance due");
    const q = await D.buildInvoice(o.id, "QUOTATION");
    expect(q.title).toBe("QUOTATION");
    expect(q.number).toMatch(/^QUO-/);
    expect(q.number).not.toBe(inv.number);
    const bytes = await R.renderDocument(inv);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });
  it("receipts exist only for verified payments and carry the running balance", async () => {
    const o = await installmentOrder(custA, 20_000_000);
    const q = await S.buildQuote({ lines: o.pricingSnapshot ? [] : [], mode: "OUTRIGHT" }).catch(() => null);
    void q;
    const pay = await db.payment.create({ data: { orderId: o.id, method: "BANK_TRANSFER", status: "AWAITING_VERIFICATION", reference: `DREF-${randomUUID()}`, expectedAmount: 1_000_000_00n } });
    await expect(D.buildReceipt(pay.id)).rejects.toThrow(/verified/);
    await S.applyVerifiedPayment({ paymentId: pay.id, paidAmount: 1_000_000_00 });
    const r = await D.buildReceipt(pay.id);
    expect(flat(r)).toContain("RECEIVED WITH THANKS");
    expect(flat(r)).toContain("₦1,000,000.00");
    expect(r.number).toMatch(/^RCT-/);
    const stmt = await D.buildInstallmentStatement(o.id);
    expect(flat(stmt)).toContain("RELEASE BLOCKED");
    expect((await D.buildPaymentStatement(o.id)).title).toBe("PAYMENT STATEMENT");
    expect((await D.buildReservation(o.id)).title).toBe("RESERVATION CONFIRMATION");
  });
  it("trade-in, swap and booking documents render", async () => {
    const t = await db.tradeIn.create({ data: { customerId: custA, make: "Toyota", model: "Corolla", year: 2016, mileageKm: 90000, valuation: 5_500_000_00n, valuationExpiresAt: new Date(Date.now() + 7 * 86_400_000), isDemo: true } });
    const s = await db.swapRequest.create({ data: { customerId: custA, ownVehicle: "2016 Honda Accord", cashDifference: -2_000_000_00n, isDemo: true } });
    const svc = await db.service.create({ data: { divisionId, slug: `dsvc-${suffix}`, name: "Doc Service", price: 10_000_00n, isDemo: true } });
    const b = await db.serviceBooking.create({ data: { serviceId: svc.id, customerId: custA, vehicleInfo: "2019 Camry", location: "Ikeja Workshop (demo)", slotStart: new Date(Date.now() + 86_400_000), slotEnd: new Date(Date.now() + 90_000_000), isDemo: true } });
    expect(flat(await D.buildTradeIn(t.id))).toContain("5,500,000.00");
    expect(flat(await D.buildSwap(s.id))).toContain("payable to you");
    expect(flat(await D.buildBooking(b.id))).toContain("Doc Service");
    for (const m of [await D.buildTradeIn(t.id), await D.buildSwap(s.id), await D.buildBooking(b.id)]) expect((await R.renderDocument(m)).length).toBeGreaterThan(2000);
  });
});

describe("document access control", () => {
  it("anonymous callers get 401, owners get a PDF, other customers and unrelated staff get 404", async () => {
    const o = await installmentOrder(custA);
    await as(null);
    expect((await call("invoice", o.orderNumber)).status).toBe(401);
    await as(userA);
    const ok = await call("invoice", o.orderNumber);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    await as(userB);
    expect((await call("invoice", o.orderNumber)).status).toBe(404);
    expect((await call("installment", o.id)).status).toBe(404);
    await as(staffInv);
    expect((await call("invoice", o.orderNumber)).status).toBe(404); // inventory staff cannot view order documents
    await as(staffSales);
    expect((await call("invoice", o.orderNumber)).status).toBe(200);
    expect((await call("nonsense", "x")).status).toBe(404);
    expect((await call("invoice", "FAG-00000000-000000")).status).toBe(404);
  });
  it("receipts: 409 for unverified payments, 404 for strangers", async () => {
    const o = await installmentOrder(custA);
    const pay = await db.payment.create({ data: { orderId: o.id, method: "BANK_TRANSFER", status: "AWAITING_VERIFICATION", reference: `DREF-${randomUUID()}`, expectedAmount: 100_00n } });
    await as(userA);
    expect((await call("receipt", pay.id)).status).toBe(409);
    await as(userB);
    expect((await call("receipt", pay.id)).status).toBe(404);
  });
});
