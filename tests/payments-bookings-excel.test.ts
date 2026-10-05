import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/fagdan_test?schema=public";
process.env.DATABASE_URL = TEST_URL;
process.env.DIRECT_URL = TEST_URL;
process.env.SETTINGS_ENCRYPTION_KEY = "payments-test-key-0123456789abcd";
process.env.PAYSTACK_SECRET_KEY = "sk_test_paymentstest";

let db: typeof import("../lib/db")["db"];
let S: typeof import("../lib/services/orders");
let P: typeof import("../lib/services/paystack");
let B: typeof import("../lib/services/bookings");
let X: typeof import("../lib/services/excel");
let U: typeof import("../lib/uploads");
let divisionId = "", customerId = "";
const suffix = randomUUID().slice(0, 8);

const mockFetch = (body: unknown, ok = true): typeof fetch => (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 })) as unknown as typeof fetch;
const verify = (status: string, amount: number, reference: string, currency = "NGN") => mockFetch({ status: true, message: "ok", data: { status, amount, reference, currency, id: 123, channel: "card" } });

async function orderAndPayment(priceNaira: number) {
  const id = randomUUID().slice(0, 8);
  const prod = await db.product.create({ data: { type: "PART", divisionId, sku: `PP-${suffix}-${id}`, slug: `pp-${suffix}-${id}`, name: "Pay Part", price: BigInt(priceNaira * 100), status: "ACTIVE", stockOnHand: 5, isDemo: true } });
  const order = await S.createOrder({ customerId, lines: [{ productId: prod.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
  const pay = await db.payment.create({ data: { orderId: order.id, method: "PAYSTACK", status: "PENDING", reference: `PSREF-${randomUUID()}`, expectedAmount: order.grandTotal } });
  return { order, pay };
}

beforeAll(async () => {
  db = (await import("../lib/db")).db;
  S = await import("../lib/services/orders");
  P = await import("../lib/services/paystack");
  B = await import("../lib/services/bookings");
  X = await import("../lib/services/excel");
  U = await import("../lib/uploads");
  divisionId = (await db.division.upsert({ where: { slug: "pay-division" }, create: { slug: "pay-division", name: "Pay Division" }, update: {} })).id;
  customerId = (await db.customer.create({ data: { name: "Pay Customer", email: `pay.${suffix}@example.test`, isDemo: true } })).id;
});

describe("Paystack verification (server-side, mocked gateway)", () => {
  it("success: credits exactly once, even if the webhook and the callback both fire", async () => {
    const { order, pay } = await orderAndPayment(100_000);
    const f = verify("success", Number(pay.expectedAmount), pay.reference);
    const results = await Promise.all([P.processPaystackReference(pay.reference, f), P.processPaystackReference(pay.reference, f), P.processPaystackReference(pay.reference, f)]);
    expect(results.filter((r) => r === "credited")).toHaveLength(1);
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe("PAID");
    expect(Number(o.amountPaid)).toBe(Number(order.grandTotal));
    expect(await db.ledgerEntry.count({ where: { orderId: order.id } })).toBe(1);
    expect(await P.processPaystackReference(pay.reference, f)).toBe("duplicate");
  });

  it("failure and abandoned payments never credit the order", async () => {
    const { order, pay } = await orderAndPayment(50_000);
    expect(await P.processPaystackReference(pay.reference, verify("failed", 0, pay.reference))).toBe("failed");
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("FAILED");
    expect(Number((await db.order.findUniqueOrThrow({ where: { id: order.id } })).amountPaid)).toBe(0);
  });

  it("pending stays pending", async () => {
    const { pay } = await orderAndPayment(50_000);
    expect(await P.processPaystackReference(pay.reference, verify("ongoing", 0, pay.reference))).toBe("pending");
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("PENDING");
  });

  it("amount, currency and reference mismatches are refused and flagged", async () => {
    for (const [amount, cur] of [[1, "NGN"], [999_999_999_99, "NGN"], [-1, "NGN"], [0, "USD"]] as const) {
      const { order, pay } = await orderAndPayment(20_000);
      const a = amount === 0 ? Number(pay.expectedAmount) : amount;
      expect(await P.processPaystackReference(pay.reference, verify("success", a, pay.reference, cur))).toBe("mismatch");
      expect(Number((await db.order.findUniqueOrThrow({ where: { id: order.id } })).amountPaid)).toBe(0);
      expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("FAILED");
      expect(await db.auditLog.count({ where: { action: "payment.mismatch", targetId: pay.id } })).toBe(1);
    }
    const { pay } = await orderAndPayment(20_000);
    expect(await P.processPaystackReference(pay.reference, verify("success", Number(pay.expectedAmount), "SOME-OTHER-REF"))).toBe("mismatch");
  });

  it("unknown references and gateway errors are handled without crediting", async () => {
    expect(await P.processPaystackReference("NOT-A-REF", verify("success", 1, "NOT-A-REF"))).toBe("unknown");
    const { pay } = await orderAndPayment(20_000);
    await expect(P.processPaystackReference(pay.reference, mockFetch({ status: false, message: "Transaction reference not found" }, false))).rejects.toThrow(/Paystack verify failed/);
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("PENDING");
  });

  it("initialize sends the server-computed kobo amount and never the browser's", async () => {
    let sent: { amount: number; currency: string } | undefined;
    const f = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ status: true, message: "ok", data: { authorization_url: "https://checkout.paystack.com/x", access_code: "ac", reference: "r" } })); }) as unknown as typeof fetch;
    const r = await P.initializeTransaction({ email: "a@b.test", amountKobo: 1_075_000_00, reference: "r", callbackUrl: "http://x/cb" }, "sk_test_x", f);
    expect(r.authorization_url).toContain("paystack");
    expect(sent).toMatchObject({ amount: 1_075_000_00, currency: "NGN" });
  });
});

describe("service booking: no double booking", () => {
  it("only one of many concurrent requests gets the same slot, and overlapping long services are blocked", async () => {
    const svc = await db.service.create({ data: { divisionId, slug: `svc-${suffix}`, name: "Test Service", price: 10_000_00n, durationMin: 120, isDemo: true } });
    const date = new Date(Date.now() + (30 + Math.floor(Math.random() * 600)) * 86_400_000).toISOString().slice(0, 10); // random day: repeatable runs
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => B.createBooking({ serviceId: svc.id, customerId, location: "Ikeja Workshop (demo)", dateStr: date, hour: 10, vehicleInfo: `Car ${i}`, isDemo: true })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]) expect(r.reason).toBeInstanceOf(B.BookingError);
    // 11:00 overlaps the 10:00-12:00 booking
    await expect(B.createBooking({ serviceId: svc.id, customerId, location: "Ikeja Workshop (demo)", dateStr: date, hour: 11, vehicleInfo: "x", isDemo: true })).rejects.toThrow(/taken/);
    // 12:00 is free; a different location is free at 10:00
    await B.createBooking({ serviceId: svc.id, customerId, location: "Ikeja Workshop (demo)", dateStr: date, hour: 12, vehicleInfo: "y", isDemo: true });
    await B.createBooking({ serviceId: svc.id, customerId, location: "Lekki Workshop (demo)", dateStr: date, hour: 10, vehicleInfo: "z", isDemo: true });
    const slots = await B.availability(svc.id, "Ikeja Workshop (demo)", date);
    expect(slots.find((s) => s.hour === 10)?.free).toBe(false);
    expect(slots.find((s) => s.hour === 11)?.free).toBe(false);
    expect(slots.find((s) => s.hour === 14)?.free).toBe(true);
  });
  it("rejects past times, closing-time overruns and unknown locations", async () => {
    const svc = await db.service.create({ data: { divisionId, slug: `svc2-${suffix}`, name: "Long Service", price: 1_00n, durationMin: 480, isDemo: true } });
    const date = new Date(Date.now() + (700 + Math.floor(Math.random() * 600)) * 86_400_000).toISOString().slice(0, 10);
    await expect(B.createBooking({ serviceId: svc.id, customerId, location: "Ikeja Workshop (demo)", dateStr: date, hour: 12, vehicleInfo: "x" })).rejects.toThrow(/closing/);
    await expect(B.createBooking({ serviceId: svc.id, customerId, location: "Moon Base", dateStr: date, hour: 9, vehicleInfo: "x" })).rejects.toThrow(/location/);
    await expect(B.createBooking({ serviceId: svc.id, customerId, location: "Ikeja Workshop (demo)", dateStr: "2020-01-01", hour: 9, vehicleInfo: "x" })).rejects.toThrow(/future/);
  });
});

async function workbook(rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventory");
  ws.columns = X.COLUMNS.map((c) => ({ header: c, key: c }));
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("Excel import validation", () => {
  it("template round-trips and is accepted by the parser", async () => {
    const parsed = await X.parseWorkbook(await X.buildTemplate());
    expect(parsed.fatal).toBeUndefined();
    expect(parsed.rows).toHaveLength(2);
  });
  it("flags missing fields, bad VINs, duplicates, unsafe image URLs and unknown divisions", async () => {
    const vin = "1HGCM82633A004352";
    const good = { "Product Type": "VEHICLE", Division: "autogallery", SKU: `XL-${suffix}-1`, "Inventory ID": `XINV-${suffix}-1`, "Stock Number": `XSTK-${suffix}-1`, VIN: vin, Make: "Toyota", Model: "Camry", Year: 2021, "Body Type": "Sedan", "Fuel Type": "Petrol", Transmission: "Automatic", Price: 25000000 };
    await db.division.upsert({ where: { slug: "autogallery" }, create: { slug: "autogallery", name: "AutoGallery" }, update: {} });
    const { rows } = await X.parseWorkbook(await workbook([
      good,
      { ...good, SKU: `XL-${suffix}-2` },                                          // duplicate VIN / stock / inventory id in file
      { ...good, SKU: `XL-${suffix}-3`, VIN: "BADVIN", "Stock Number": "A", "Inventory ID": "B" },
      { ...good, SKU: `XL-${suffix}-4`, VIN: "", "Stock Number": "C", "Inventory ID": "D", "Image 1": "http://insecure.example/a.jpg", "Image 2": "https://192.168.0.5/a.jpg", "Image 3": "https://ok.example/file.exe" },
      { ...good, SKU: `XL-${suffix}-5`, VIN: "", "Stock Number": "E", "Inventory ID": "F", Division: "nope", Price: "abc" },
      { "Product Type": "PART", Division: "autogallery", SKU: `XL-${suffix}-6`, Price: 5000 },  // missing name
    ]));
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].warnings.join()).toMatch(/No image/);
    expect(rows[1].errors.join()).toMatch(/Duplicate VIN/);
    expect(rows[2].errors.join()).toMatch(/VIN must be/);
    expect(rows[3].errors.join()).toMatch(/Image 1: must be https/);
    expect(rows[3].errors.join()).toMatch(/Image 2: private/);
    expect(rows[3].errors.join()).toMatch(/Image 3: must be a \.jpg/);
    expect(rows[4].errors.join()).toMatch(/Unknown division/);
    expect(rows[4].errors.join()).toMatch(/Price must be/);
    expect(rows[5].errors.join()).toMatch(/Name is required/);
  });
  it("imports valid rows, skips bad ones, flags missing images with a placeholder, and keeps VIN unique", async () => {
    const user = await db.user.create({ data: { kind: "STAFF", email: `imp.${suffix}@example.test`, name: "Importer", passwordHash: "x" } });
    const vin = `XV${randomUUID().replace(/-/g, "").slice(0, 15).toUpperCase()}`;
    const base = { "Product Type": "VEHICLE", Division: "autogallery", Make: "Honda", Model: "Accord", Year: 2020, "Body Type": "Sedan", "Fuel Type": "Petrol", Transmission: "Automatic", Price: 18000000, Status: "DRAFT" };
    const { rows } = await X.parseWorkbook(await workbook([
      { ...base, SKU: `IM-${suffix}-1`, "Inventory ID": `IMI-${suffix}-1`, "Stock Number": `IMS-${suffix}-1`, VIN: vin },
      { "Product Type": "ACCESSORY", Division: "autogallery", SKU: `IM-${suffix}-2`, Name: "Seat Cover", Price: 50000, "Stock Quantity": 12, Compatibility: "Toyota | Camry | 2018 | 2024; Honda | Accord | 2016 | 2022", "Image 1": "https://cdn.example.com/cover.jpg" },
      { ...base, SKU: `IM-${suffix}-3`, "Inventory ID": `IMI-${suffix}-3`, "Stock Number": `IMS-${suffix}-3`, VIN: "BAD" },
    ]));
    const job = await db.importJob.create({ data: { kind: "inventory", status: "VALIDATED", total: rows.length, actorId: user.id } });
    const res = await X.importRows(rows, user.id, job.id);
    expect(res.ok).toBe(2);
    expect(res.failures).toHaveLength(1);
    const car = await db.product.findUniqueOrThrow({ where: { sku: `IM-${suffix}-1` }, include: { images: true, vehicle: true } });
    expect(car.needsImage).toBe(true);
    expect(car.images[0].isPlaceholder).toBe(true);
    expect(car.vehicle?.vin).toBe(vin);
    expect(car.status).toBe("DRAFT");
    const acc = await db.product.findUniqueOrThrow({ where: { sku: `IM-${suffix}-2` }, include: { images: true, compat: true } });
    expect(acc.compat).toHaveLength(2);
    expect(acc.images[0].url).toBe("https://cdn.example.com/cover.jpg");
    expect(acc.stockOnHand).toBe(12);
    // re-validating the same file now reports that the SKU will be updated, while a *different* SKU reusing the VIN is rejected
    const again = await X.parseWorkbook(await workbook([{ ...base, SKU: `IM-${suffix}-9`, "Inventory ID": `IMI-${suffix}-9`, "Stock Number": `IMS-${suffix}-9`, VIN: vin }]));
    expect(again.rows[0].errors.join()).toMatch(/VIN already belongs/);
  });
  it("rejects non-xlsx and files missing required columns", async () => {
    expect((await X.parseWorkbook(Buffer.from("not a spreadsheet"))).fatal).toMatch(/not a valid/);
    const wb = new ExcelJS.Workbook(); wb.addWorksheet("Inventory").addRow(["Foo", "Bar"]);
    expect((await X.parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()))).fatal).toMatch(/Missing required column/);
  });
});

describe("secure upload validation", () => {
  const file = (bytes: number[], name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
  it("accepts real images and PDFs", async () => {
    expect((await U.validateUpload(file(png, "p.png", "image/png"), U.PROOF_RULE)).ext).toBe("png");
    expect((await U.validateUpload(file([0x25, 0x50, 0x44, 0x46, 1, 2], "p.pdf", "application/pdf"), U.PROOF_RULE)).ext).toBe("pdf");
  });
  it("rejects executables, mismatched types, spoofed content, oversize and empty files", async () => {
    await expect(U.validateUpload(file([0x4d, 0x5a, 0x90, 0], "virus.exe", "application/octet-stream"), U.PROOF_RULE)).rejects.toThrow(/not allowed/);
    await expect(U.validateUpload(file([0x4d, 0x5a, 0x90, 0], "virus.png", "image/png"), U.PROOF_RULE)).rejects.toThrow(/content/);
    await expect(U.validateUpload(file(png, "p.png", "application/pdf"), U.PROOF_RULE)).rejects.toThrow(/does not match/);
    await expect(U.validateUpload(file(png, "p.pdf", "application/pdf"), U.PROOF_RULE)).rejects.toThrow(/content/);
    await expect(U.validateUpload(file(png, "p.svg", "image/svg+xml"), U.PROOF_RULE)).rejects.toThrow(/not allowed/);
    await expect(U.validateUpload(file([0x25, 0x50, 0x44, 0x46], "p.pdf", "application/pdf"), U.PHOTO_RULE)).rejects.toThrow(/not allowed/);
    await expect(U.validateUpload(new File([], "e.png", { type: "image/png" }), U.PROOF_RULE)).rejects.toThrow(/No file/);
    await expect(U.validateUpload(new File([new Uint8Array(5 * 1024 * 1024)], "big.png", { type: "image/png" }), U.PROOF_RULE)).rejects.toThrow(/too large/);
  });
});
