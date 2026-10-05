import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

// Point every module at the isolated test database BEFORE importing app code.
const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/fagdan_test?schema=public";
process.env.DATABASE_URL = TEST_URL;
process.env.DIRECT_URL = TEST_URL;
process.env.SETTINGS_ENCRYPTION_KEY = "integration-test-key-0123456789";

type Svc = typeof import("../lib/services/orders");
type Db = typeof import("../lib/db");
let S: Svc;
let db: Db["db"];
let division: { id: string };
let customers: { id: string }[] = [];
let staffId = "";
const suffix = randomUUID().slice(0, 8);

async function vehicle(priceNaira: number, opts: { installment?: boolean } = {}) {
  const id = randomUUID().slice(0, 8);
  return db.product.create({
    data: {
      type: "VEHICLE", divisionId: division.id, sku: `T-${suffix}-${id}`, slug: `t-${suffix}-${id}`, name: `Test Vehicle ${id}`, price: BigInt(priceNaira * 100),
      status: "ACTIVE", stockOnHand: 1, isDemo: true,
      vehicle: { create: { inventoryId: `TINV-${suffix}-${id}`, stockNumber: `TSTK-${suffix}-${id}`, vin: `TESTVIN${suffix}${id}`.slice(0, 17).padEnd(17, "0"), makeName: "Test", modelName: "Car", year: 2024, bodyType: "Sedan", fuelType: "Petrol", transmission: "Automatic", installmentAvailable: !!opts.installment, isDemo: true } },
    },
    include: { vehicle: true },
  });
}
async function part(priceNaira: number, stock: number) {
  const id = randomUUID().slice(0, 8);
  return db.product.create({ data: { type: "PART", divisionId: division.id, sku: `P-${suffix}-${id}`, slug: `p-${suffix}-${id}`, name: `Test Part ${id}`, price: BigInt(priceNaira * 100), status: "ACTIVE", stockOnHand: stock, isDemo: true } });
}
async function pay(orderId: string, amountKobo: number) {
  const p = await db.payment.create({ data: { orderId, method: "BANK_TRANSFER", status: "INITIATED", reference: `TREF-${randomUUID()}`, expectedAmount: BigInt(amountKobo) } });
  return S.applyVerifiedPayment({ paymentId: p.id, paidAmount: amountKobo });
}

beforeAll(async () => {
  db = (await import("../lib/db")).db;
  S = await import("../lib/services/orders");
  division = await db.division.upsert({ where: { slug: "test-division" }, create: { slug: "test-division", name: "Test Division" }, update: {} });
  staffId = (await db.user.create({ data: { kind: "STAFF", email: `staff.${suffix}@example.test`, name: "Test Staff", passwordHash: "x" } })).id;
  for (let i = 0; i < 4; i++) customers.push(await db.customer.create({ data: { name: `Tester ${i}`, email: `t${i}.${suffix}@example.test`, isDemo: true } }));
});
afterAll(async () => { await db.$disconnect(); });

describe("inventory race condition", () => {
  it("only one of ten simultaneous buyers can get the same vehicle", async () => {
    const car = await vehicle(10_000_000);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => S.createOrder({ customerId: customers[i % 4].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(9);
    for (const f of failed) expect(f.reason).toBeInstanceOf(S.OrderError);
    const p = await db.product.findUniqueOrThrow({ where: { id: car.id } });
    expect(p.stockReserved).toBe(1);
    expect(await db.reservation.count({ where: { productId: car.id, status: "ACTIVE" } })).toBe(1);
  });

  it("parts: never oversell, stock never negative", async () => {
    const pr = await part(5_000, 5);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => S.createOrder({ customerId: customers[i % 4].id, lines: [{ productId: pr.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const p = await db.product.findUniqueOrThrow({ where: { id: pr.id } });
    expect(p.stockReserved).toBe(5);
    expect(p.stockOnHand - p.stockReserved).toBe(0);
  });

  it("database constraint blocks negative stock even if code is bypassed", async () => {
    const pr = await part(1_000, 1);
    await expect(db.product.update({ where: { id: pr.id }, data: { stockOnHand: -1 } })).rejects.toThrow();
    await expect(db.product.update({ where: { id: pr.id }, data: { stockReserved: 5 } })).rejects.toThrow();
  });

  it("duplicate VIN and stock number are rejected", async () => {
    const a = await vehicle(1_000_000);
    await expect(db.vehicle.create({ data: { productId: (await vehicle(1_000_000)).id, inventoryId: "X-" + randomUUID(), stockNumber: a.vehicle!.stockNumber, makeName: "T", modelName: "T", year: 2020, bodyType: "S", fuelType: "P", transmission: "A" } })).rejects.toThrow();
  });

  it("expired reservations release the vehicle", async () => {
    const car = await vehicle(8_000_000);
    const order = await S.createOrder({ customerId: customers[0].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    await db.reservation.updateMany({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await S.expireReservations()).toBeGreaterThanOrEqual(1);
    const p = await db.product.findUniqueOrThrow({ where: { id: car.id } });
    expect(p.stockReserved).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
    const again = await S.createOrder({ customerId: customers[1].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    expect(again.id).toBeTruthy();
  });
});

describe("server-authoritative pricing", () => {
  it("quote VAT on/off from server settings (spec test: N10m)", async () => {
    const car = await vehicle(10_000_000);
    const q = await S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT" });
    expect(q.pricing.vatTotal).toBe(75_000_000);
    expect(q.pricing.grandTotal).toBe(1_075_000_000);
  });
  it("buyer cannot switch VAT off while policy forbids it (default)", async () => {
    const car = await vehicle(10_000_000);
    await expect(S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", vatOffRequested: true })).rejects.toMatchObject({ code: "VAT_NOT_ALLOWED" });
  });
  it("vehicle quantity > 1 is rejected", async () => {
    const car = await vehicle(1_000_000);
    await expect(S.buildQuote({ lines: [{ productId: car.id, quantity: 2 }], mode: "OUTRIGHT" })).rejects.toThrow();
  });
  it("installment only for eligible vehicles", async () => {
    const car = await vehicle(10_000_000, { installment: false });
    await expect(S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: 1 })).rejects.toThrow();
  });
  it("client cannot influence price: order totals come only from the DB", async () => {
    const car = await vehicle(2_000_000);
    const o = await S.createOrder({ customerId: customers[0].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    expect(Number(o.grandTotal)).toBe(2_150_000_00);
  });
});

describe("VAT policy and audit when allowed", () => {
  it("records a VatRecord and audit entry with the removed amount", async () => {
    const set = await import("../lib/settings");
    for (const k of ["vat.buyerCanDisable", "vat.disableForVehicles"]) await set.setSetting(k, true, null, "test");
    await set.setSetting("vat.requireApproval", false, null, "test");
    try {
      const car = await vehicle(10_000_000);
      await expect(S.createOrder({ customerId: customers[0].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", vatOffRequested: true, isDemo: true })).rejects.toThrow(/reason/i);
      const o = await S.createOrder({ customerId: customers[0].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", vatOffRequested: true, vatOffReason: "Registered VAT-exempt entity", isDemo: true });
      expect(Number(o.vatTotal)).toBe(0);
      expect(Number(o.grandTotal)).toBe(1_000_000_000);
      const rec = await db.vatRecord.findFirstOrThrow({ where: { orderId: o.id } });
      expect(Number(rec.vatRemoved)).toBe(75_000_000);
      expect(rec.previousState).toBe(true);
      expect(rec.newState).toBe(false);
      expect(await db.auditLog.count({ where: { action: "vat.switch_off", targetId: o.id } })).toBe(1);
    } finally {
      for (const k of ["vat.buyerCanDisable", "vat.disableForVehicles"]) await set.setSetting(k, false, null, "test cleanup");
      await set.setSetting("vat.requireApproval", true, null, "test cleanup");
    }
  });
});

describe("installment release rule (server-enforced)", () => {
  it("blocks release below threshold, allows at threshold, and Super Admin override is audited", async () => {
    const car = await vehicle(50_000_000, { installment: true });
    const q = await S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: 0 });
    const order = await S.createOrder({ customerId: customers[2].id, lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: q.minDeposit, isDemo: true });
    expect(Number(order.grandTotal)).toBe(5_912_500_000); // 55m + 4.125m VAT
    expect(Number(order.releaseThreshold)).toBe(5_321_250_000); // 90% of VAT-inclusive total
    const actor = { id: staffId };

    const threshold = Number(order.releaseThreshold);
    await pay(order.id, threshold - 1);
    let o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.releaseState).toBe("BLOCKED");
    await expect(S.transitionOrder(order.id, "READY_FOR_COLLECTION", actor)).rejects.toThrow(/RELEASE BLOCKED/);
    await expect(S.transitionOrder(order.id, "DELIVERED", actor)).rejects.toThrow();
    expect(await db.auditLog.count({ where: { action: "release.denied", targetId: order.id } })).toBeGreaterThanOrEqual(1);

    // a non-super-admin cannot override even with a reason
    await expect(S.transitionOrder(order.id, "READY_FOR_COLLECTION", { id: actor.id, canOverrideRelease: false }, "x", "Customer is a VIP, approved verbally")).rejects.toThrow(/RELEASE BLOCKED/);

    await pay(order.id, 1); // now exactly at the threshold
    o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.releaseState).toBe("ELIGIBLE");
    expect(Number(o.amountPaid)).toBe(threshold);
    await S.transitionOrder(order.id, "PROCESSING", actor);
    await S.transitionOrder(order.id, "READY_FOR_COLLECTION", actor);
  });

  it("super admin override requires a real reason and leaves an audit trail", async () => {
    const car = await vehicle(20_000_000, { installment: true });
    const q = await S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: 0 });
    const order = await S.createOrder({ customerId: customers[3].id, lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: q.minDeposit, isDemo: true });
    await pay(order.id, q.minDeposit);
    await expect(S.transitionOrder(order.id, "READY_FOR_COLLECTION", { id: staffId, canOverrideRelease: true }, undefined, "short")).rejects.toThrow(/RELEASE BLOCKED/);
    await S.transitionOrder(order.id, "READY_FOR_COLLECTION", { id: staffId, canOverrideRelease: true }, undefined, "Written authorisation from the MD on file");
    const rd = await db.releaseDecision.findFirstOrThrow({ where: { orderId: order.id, overridden: true } });
    expect(rd.reason).toContain("MD");
    expect(await db.auditLog.count({ where: { action: "release.override", targetId: order.id } })).toBe(1);
  });

  it("outright vehicle cannot be released until fully paid", async () => {
    const car = await vehicle(9_000_000);
    const order = await S.createOrder({ customerId: customers[0].id, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    await pay(order.id, 100_000_00);
    await expect(S.transitionOrder(order.id, "READY_FOR_COLLECTION", { id: staffId })).rejects.toThrow(/BLOCKED/);
    await pay(order.id, Number(order.grandTotal) - 100_000_00);
    await S.transitionOrder(order.id, "READY_FOR_COLLECTION", { id: staffId });
    await S.transitionOrder(order.id, "DELIVERED", { id: staffId });
    const p = await db.product.findUniqueOrThrow({ where: { id: car.id } });
    expect(p.status).toBe("SOLD");
    expect(p.stockOnHand).toBe(0);
    expect(p.stockReserved).toBe(0);
  });
});

describe("payments: idempotency and integrity", () => {
  it("replaying the same verified payment never double-credits", async () => {
    const pr = await part(100_000, 10);
    const order = await S.createOrder({ customerId: customers[0].id, lines: [{ productId: pr.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    const p = await db.payment.create({ data: { orderId: order.id, method: "PAYSTACK", status: "INITIATED", reference: `TREF-${randomUUID()}`, expectedAmount: order.grandTotal } });
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => S.applyVerifiedPayment({ paymentId: p.id, paidAmount: Number(order.grandTotal) })));
    expect([a, b, c].filter((x) => !x.duplicate)).toHaveLength(1);
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(Number(o.amountPaid)).toBe(Number(order.grandTotal));
    expect(o.status).toBe("PAID");
    expect(await db.ledgerEntry.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("duplicate payment reference is rejected by the database", async () => {
    const pr = await part(1_000, 10);
    const order = await S.createOrder({ customerId: customers[0].id, lines: [{ productId: pr.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    const ref = `TREF-${randomUUID()}`;
    await db.payment.create({ data: { orderId: order.id, method: "PAYSTACK", reference: ref, expectedAmount: 1n } });
    await expect(db.payment.create({ data: { orderId: order.id, method: "PAYSTACK", reference: ref, expectedAmount: 1n } })).rejects.toThrow();
  });

  it("ledger and audit log are append-only", async () => {
    const entry = await db.ledgerEntry.findFirstOrThrow();
    await expect(db.ledgerEntry.update({ where: { id: entry.id }, data: { amount: 1n } })).rejects.toThrow(/append-only/);
    await expect(db.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
    const log = await db.auditLog.findFirstOrThrow();
    await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "tampered" } })).rejects.toThrow(/append-only/);
  });

  it("order numbers are unique, sequential and correctly formatted under concurrency", async () => {
    const prs = await Promise.all(Array.from({ length: 6 }, () => part(1_000, 5)));
    const orders = await Promise.all(prs.map((p, i) => S.createOrder({ customerId: customers[i % 4].id, lines: [{ productId: p.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true })));
    const nums = orders.map((o) => o.orderNumber);
    expect(new Set(nums).size).toBe(6);
    for (const n of nums) expect(n).toMatch(/^FAG-\d{8}-\d{6}$/);
  });

  it("no impossible balances: nothing negative anywhere", async () => {
    const bad = await db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) c FROM "Order" WHERE "amountPaid" < 0 OR "grandTotal" < 0`;
    expect(Number(bad[0].c)).toBe(0);
    const neg = await db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) c FROM "Product" WHERE "stockOnHand" < 0 OR "stockReserved" < 0`;
    expect(Number(neg[0].c)).toBe(0);
  });
});
