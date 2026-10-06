import { describe, it, expect, beforeAll } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/fagdan_test?schema=public";
process.env.DATABASE_URL = TEST_URL;
process.env.DIRECT_URL = TEST_URL;
process.env.SETTINGS_ENCRYPTION_KEY = "security-test-key-0123456789abc";
process.env.AUTH_SECRET = "security-test-auth-secret-0123456789-abcdefghij";
process.env.CRON_SECRET = "cron-test-secret";
delete process.env.PAYSTACK_SECRET_KEY;

type Mod<T> = T;
let db: Mod<typeof import("../lib/db")>["db"];
let headersStub: typeof import("./stubs/next-headers");
let S: typeof import("../lib/services/orders");
let sessionLib: typeof import("../lib/auth/session");
let perms: typeof import("../lib/rbac/permissions");
const suffix = randomUUID().slice(0, 8);
const users: Record<string, { id: string; version: number }> = {};
let divisionId = "";
let customerId = "";

/** Server actions end in redirect(); unwrap the target URL from the thrown NEXT_REDIRECT error. */
async function run(fn: () => Promise<unknown>): Promise<string | null> {
  try { await fn(); return null; }
  catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return decodeURIComponent(digest.split(";")[2]);
    throw e;
  }
}
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
async function as(role: string | null) {
  headersStub.__reset();
  if (role) await sessionLib.createSession(users[role].id, users[role].version);
}
const denied = (url: string | null) => !!url && (/error=/.test(url) && /permission|Only an authorised|cannot/i.test(url) || /\/admin\/login|denied=1/.test(url));

beforeAll(async () => {
  db = (await import("../lib/db")).db;
  headersStub = await import("./stubs/next-headers");
  S = await import("../lib/services/orders");
  sessionLib = await import("../lib/auth/session");
  perms = await import("../lib/rbac/permissions");
  // repeatable runs: clear state this suite creates
  await db.bankAccount.deleteMany({ where: { accountNumber: "0123456789" } });
  await db.paymentGateway.deleteMany({ where: { key: "paystack" } });
  const pwHash = await sessionLib.hashPassword("Test-Password-123");
  for (const r of perms.ROLES) {
    const role = await db.role.upsert({ where: { key: r.key }, create: { key: r.key, name: r.name }, update: {} });
    const u = await db.user.create({ data: { kind: r.key === "CUSTOMER" ? "CUSTOMER" : "STAFF", email: `${r.key.toLowerCase()}.${suffix}@example.test`, name: r.name, passwordHash: pwHash, roleId: role.id } });
    users[r.key] = { id: u.id, version: u.sessionVersion };
  }
  divisionId = (await db.division.upsert({ where: { slug: "sec-division" }, create: { slug: "sec-division", name: "Sec Division" }, update: {} })).id;
  customerId = (await db.customer.create({ data: { name: "Sec Customer", email: `cust.${suffix}@example.test`, isDemo: true } })).id;
});

async function vehicle(priceNaira: number, installment = false) {
  const id = randomUUID().slice(0, 8);
  return db.product.create({ data: { type: "VEHICLE", divisionId, sku: `S-${suffix}-${id}`, slug: `s-${suffix}-${id}`, name: `Sec Car ${id}`, price: BigInt(priceNaira * 100), status: "ACTIVE", stockOnHand: 1, isDemo: true, vehicle: { create: { inventoryId: `SINV-${suffix}-${id}`, stockNumber: `SSTK-${suffix}-${id}`, makeName: "T", modelName: "C", year: 2024, bodyType: "Sedan", fuelType: "Petrol", transmission: "Automatic", installmentAvailable: installment, isDemo: true } } } });
}

describe("unauthenticated access", () => {
  it("admin export, files and cron endpoints reject anonymous callers", async () => {
    await as(null);
    const exp = await import("../app/admin/export/[kind]/route");
    expect((await exp.GET(new NextRequest("http://x/admin/export/payments"), { params: Promise.resolve({ kind: "payments" }) })).status).toBe(401);
    const files = await import("../app/api/files/[...path]/route");
    expect((await files.GET(new NextRequest("http://x/api/files/a.png"), { params: Promise.resolve({ path: ["proofs", "a.png"] }) })).status).toBe(401);
    const cron = await import("../app/api/cron/reservations/route");
    expect((await cron.GET(new NextRequest("http://x/api/cron/reservations"))).status).toBe(401);
    expect((await cron.GET(new NextRequest("http://x/api/cron/reservations", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await cron.GET(new NextRequest("http://x/api/cron/reservations", { headers: { authorization: "Bearer cron-test-secret" } }))).status).toBe(200);
  });

  it("customers cannot reach staff exports, and path traversal is refused", async () => {
    await as("CUSTOMER");
    const exp = await import("../app/admin/export/[kind]/route");
    expect((await exp.GET(new NextRequest("http://x"), { params: Promise.resolve({ kind: "orders" }) })).status).toBe(401);
    const files = await import("../app/api/files/[...path]/route");
    expect((await files.GET(new NextRequest("http://x"), { params: Promise.resolve({ path: ["..", "..", ".env"] }) })).status).toBe(400);
  });

  it("every server action redirects anonymous callers to sign in instead of acting", async () => {
    await as(null);
    const fin = await import("../app/actions/admin-finance");
    const settings = await import("../app/actions/admin-settings");
    const users = await import("../app/actions/admin-users");
    const checks = [
      () => fin.verifyPaymentAction(form({ paymentId: "x", decision: "approve" })),
      () => fin.transitionOrderAction(form({ orderId: "x", to: "DELIVERED" })),
      () => fin.refundAction(form({ orderId: "x", amountNaira: "1", reason: "long enough reason" })),
      () => fin.vatDecisionAction(form({ recordId: "x", decision: "approve" })),
      () => settings.savePaystack(form({ mode: "test" })),
      () => settings.saveBank(form({ bankName: "B", accountName: "A", accountNumber: "0123456789" })),
      () => users.createStaff(form({ name: "X Y", email: "x@y.test", roleKey: "SALES_MANAGER" })),
    ];
    for (const c of checks) expect(await run(c)).toMatch(/admin\/login/);
  });
});

describe("webhook signature", () => {
  it("rejects missing or forged Paystack signatures before touching any data", async () => {
    await as(null);
    const { POST } = await import("../app/api/paystack/webhook/route");
    process.env.PAYSTACK_SECRET_KEY = "sk_test_securitysecret";
    try {
      const body = JSON.stringify({ event: "charge.success", data: { reference: "NOPE", amount: 100 } });
      expect((await POST(new NextRequest("http://x/api/paystack/webhook", { method: "POST", body }))).status).toBe(401);
      expect((await POST(new NextRequest("http://x/api/paystack/webhook", { method: "POST", body, headers: { "x-paystack-signature": "deadbeef" } }))).status).toBe(401);
      const sig = createHmac("sha512", "sk_test_securitysecret").update(body).digest("hex");
      expect((await POST(new NextRequest("http://x/api/paystack/webhook", { method: "POST", body, headers: { "x-paystack-signature": sig } }))).status).toBe(200); // valid signature, unknown reference: acknowledged, nothing credited
    } finally { delete process.env.PAYSTACK_SECRET_KEY; }
  });
});

describe("role-based authorisation is enforced by the backend", () => {
  it("only the Super Admin can change VAT configuration", async () => {
    const { saveSettings } = await import("../app/actions/admin-settings");
    const { getSetting } = await import("../lib/settings");
    for (const role of ["FINANCE_MANAGER", "TECH_ADMIN", "SALES_MANAGER", "INVENTORY_MANAGER"]) {
      await as(role);
      const url = await run(() => saveSettings(form({ group: "vat", "s:vat.rateBps": "0", "s:vat.buyerCanDisable": "true", reason: "trying to cheat" })));
      expect(denied(url) || (url ?? "").includes("error="), `${role} -> ${url}`).toBe(true);
    }
    expect(await getSetting("vat.rateBps")).toBe(750);
    expect(await getSetting("vat.buyerCanDisable")).toBe(false);
    await as("SUPER_ADMIN");
    await run(() => saveSettings(form({ group: "vat", "s:vat.rateBps": "750", "s:vat.buyerCanDisable": "false", reason: "no change" })));
    // a real change with a reason is accepted for Super Admin, requires a reason, and is versioned + audited
    expect(await run(() => saveSettings(form({ group: "vat", "s:vat.rateBps": "800" })))).toMatch(/reason/i);
    await run(() => saveSettings(form({ group: "vat", "s:vat.rateBps": "800", reason: "Test rate change" })));
    expect(await getSetting("vat.rateBps")).toBe(800);
    expect(await db.settingVersion.count({ where: { key: "vat.rateBps", actorId: users.SUPER_ADMIN.id } })).toBeGreaterThanOrEqual(1);
    expect(await db.auditLog.count({ where: { action: "settings.vat.rateBps.update", actorId: users.SUPER_ADMIN.id } })).toBeGreaterThanOrEqual(1);
    await run(() => saveSettings(form({ group: "vat", "s:vat.rateBps": "750", reason: "Restore standard rate" })));
    expect(await getSetting("vat.rateBps")).toBe(750);
  });

  it("only the Super Admin can configure Paystack, and secrets are stored encrypted", async () => {
    const { savePaystack } = await import("../app/actions/admin-settings");
    for (const role of ["FINANCE_MANAGER", "TECH_ADMIN", "MARKETING_MANAGER"]) {
      await as(role);
      expect(denied(await run(() => savePaystack(form({ mode: "test", secretKey: "sk_test_hacker123", enabled: "on" }))))).toBe(true);
    }
    expect((await db.paymentGateway.findUnique({ where: { key: "paystack" } }))?.secretKeyEnc ?? null).toBeNull();
    await as("SUPER_ADMIN");
    expect(await run(() => savePaystack(form({ mode: "live", secretKey: "sk_test_abc12345" })))).toMatch(/does not match/);
    await run(() => savePaystack(form({ mode: "test", publicKey: "pk_test_abc12345", secretKey: "sk_test_abc12345", enabled: "on" })));
    const row = await db.paymentGateway.findUniqueOrThrow({ where: { key: "paystack" } });
    expect(row.secretKeyEnc).toBeTruthy();
    expect(row.secretKeyEnc).not.toContain("sk_test_abc12345");
    const logs = JSON.stringify(await db.auditLog.findMany({ where: { action: "settings.paystack.update" } }));
    expect(logs).not.toContain("sk_test_abc12345"); // never leaked into the audit trail
  });

  it("only the Super Admin can change bank accounts", async () => {
    const { saveBank } = await import("../app/actions/admin-settings");
    const base = { bankName: "GTBank", accountName: "FAGDAN", accountNumber: "0123456789", isActive: "on" };
    for (const role of ["FINANCE_MANAGER", "SALES_MANAGER"]) { await as(role); expect(denied(await run(() => saveBank(form(base))))).toBe(true); }
    expect(await db.bankAccount.count({ where: { accountNumber: "0123456789" } })).toBe(0);
    await as("SUPER_ADMIN");
    expect(await run(() => saveBank(form({ ...base, accountNumber: "0000000000" })))).toMatch(/Placeholder/);
    expect(await run(() => saveBank(form({ ...base, accountNumber: "12345" })))).toMatch(/10 digits/);
    await run(() => saveBank(form(base)));
    expect(await db.bankAccount.count({ where: { accountNumber: "0123456789" } })).toBe(1);
  });

  it("only the Super Admin can create staff or change roles", async () => {
    const { createStaff, updateStaff } = await import("../app/actions/admin-users");
    for (const role of ["SALES_MANAGER", "TECH_ADMIN", "FINANCE_MANAGER"]) {
      await as(role);
      expect(denied(await run(() => createStaff(form({ name: "Evil Admin", email: `evil.${suffix}@example.test`, roleKey: "SUPER_ADMIN" }))))).toBe(true);
      expect(denied(await run(() => updateStaff(form({ id: users.INVENTORY_MANAGER.id, intent: "role", roleKey: "SUPER_ADMIN" }))))).toBe(true);
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: users.INVENTORY_MANAGER.id }, include: { role: true } })).role?.key).toBe("INVENTORY_MANAGER");
    await as("SUPER_ADMIN");
    expect(await run(() => updateStaff(form({ id: users.INVENTORY_MANAGER.id, intent: "role", roleKey: "CUSTOMER" })))).toMatch(/Invalid role/);
  });

  it("payment verification: finance can verify, others cannot, override is super-only with a real reason", async () => {
    const { verifyPaymentAction } = await import("../app/actions/admin-finance");
    const car = await vehicle(9_000_000);
    const order = await S.createOrder({ customerId, lines: [{ productId: car.id, quantity: 1 }], mode: "OUTRIGHT", isDemo: true });
    const pay = await db.payment.create({ data: { orderId: order.id, method: "BANK_TRANSFER", status: "AWAITING_VERIFICATION", reference: `SREF-${randomUUID()}`, expectedAmount: order.grandTotal, proofUrl: "/api/files/x.png" } });
    const approve = form({ paymentId: pay.id, decision: "approve", receivedNaira: String(Number(order.grandTotal) / 100), returnTo: "/admin/payments" });
    for (const role of ["INVENTORY_MANAGER", "MARKETING_MANAGER", "SALES_MANAGER", "CUSTOMER"]) { await as(role); expect(denied(await run(() => verifyPaymentAction(approve)))).toBe(true); }
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe("AWAITING_VERIFICATION");
    expect(Number((await db.order.findUniqueOrThrow({ where: { id: order.id } })).amountPaid)).toBe(0);
    // finance cannot override
    await as("FINANCE_MANAGER");
    expect(denied(await run(() => verifyPaymentAction(form({ paymentId: pay.id, decision: "override_approve", reason: "I am the boss of this payment" }))))).toBe(true);
    await as("SUPER_ADMIN");
    expect(await run(() => verifyPaymentAction(form({ paymentId: pay.id, decision: "override_approve", reason: "short" })))).toMatch(/reason/);
    // finance approves properly
    await as("FINANCE_MANAGER");
    await run(() => verifyPaymentAction(approve));
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(Number(o.amountPaid)).toBe(Number(order.grandTotal));
    expect(o.status).toBe("PAID");
    expect(await db.auditLog.count({ where: { action: "payment.verified", targetId: pay.id } })).toBe(1);
  });

  it("vehicle release: nobody except the Super Admin can bypass the 90% rule, and a denied attempt is audited", async () => {
    const { transitionOrderAction } = await import("../app/actions/admin-finance");
    const car = await vehicle(20_000_000, true);
    const q = await S.buildQuote({ lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: 0 });
    const order = await S.createOrder({ customerId, lines: [{ productId: car.id, quantity: 1 }], mode: "INSTALLMENT", deposit: q.minDeposit, isDemo: true });
    const p = await db.payment.create({ data: { orderId: order.id, method: "BANK_TRANSFER", status: "INITIATED", reference: `SREF-${randomUUID()}`, expectedAmount: BigInt(q.minDeposit) } });
    await S.applyVerifiedPayment({ paymentId: p.id, paidAmount: q.minDeposit });
    for (const role of ["SALES_MANAGER", "FINANCE_MANAGER"]) {
      await as(role);
      const url = await run(() => transitionOrderAction(form({ orderId: order.id, to: "READY_FOR_COLLECTION", overrideReason: "Customer is my friend, release the car" })));
      expect(url, role).toMatch(role === "SALES_MANAGER" ? /RELEASE BLOCKED/ : /permission/); // finance has no orders:edit at all
    }
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PARTIALLY_PAID");
    await as("INVENTORY_MANAGER"); // has no orders:edit at all
    expect(denied(await run(() => transitionOrderAction(form({ orderId: order.id, to: "DELIVERED" }))))).toBe(true);
    expect(await db.auditLog.count({ where: { action: "release.denied", targetId: order.id } })).toBeGreaterThanOrEqual(1);
    await as("SUPER_ADMIN");
    await run(() => transitionOrderAction(form({ orderId: order.id, to: "READY_FOR_COLLECTION", overrideReason: "Written authorisation from the MD is on file" })));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("READY_FOR_COLLECTION");
    expect(await db.auditLog.count({ where: { action: "release.override", targetId: order.id } })).toBe(1);
  });

  it("inventory changes need inventory permissions; price changes are audited", async () => {
    const { saveProduct, adjustStock } = await import("../app/actions/admin-products");
    const prod = await db.product.create({ data: { type: "PART", divisionId, sku: `PX-${suffix}`, slug: `px-${suffix}`, name: "Security Part", price: 10_000_00n, status: "ACTIVE", stockOnHand: 10, isDemo: true } });
    const edit = (price: string) => form({ id: prod.id, type: "PART", name: "Security Part", sku: prod.sku, divisionId, priceNaira: price, status: "ACTIVE", vatApplicable: "on", stockOnHand: "10" });
    for (const role of ["FINANCE_MANAGER", "CUSTOMER_RELATIONS", "AUTO_CARE_MANAGER"]) { await as(role); expect(denied(await run(() => saveProduct(edit("1"))))).toBe(true); expect(denied(await run(() => adjustStock(form({ id: prod.id, delta: "-9", reason: "steal stock" }))))).toBe(true); }
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: prod.id } })).price)).toBe(10_000_00);
    await as("INVENTORY_MANAGER");
    await run(() => saveProduct(edit("12500")));
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: prod.id } })).price)).toBe(12_500_00);
    expect(await db.auditLog.count({ where: { action: "product.price_change", targetId: prod.id } })).toBe(1);
    expect(await run(() => adjustStock(form({ id: prod.id, delta: "-50", reason: "bad count" })))).toMatch(/error|reserved|not allowed/i);
    expect((await db.product.findUniqueOrThrow({ where: { id: prod.id } })).stockOnHand).toBeGreaterThanOrEqual(0);
  });

  it("export permissions are per dataset", async () => {
    const exp = await import("../app/admin/export/[kind]/route");
    const call = async (role: string, kind: string) => { await as(role); return (await exp.GET(new NextRequest("http://x"), { params: Promise.resolve({ kind }) })).status; };
    expect(await call("MARKETING_MANAGER", "payments")).toBe(403);
    expect(await call("INVENTORY_MANAGER", "vat")).toBe(403);
    expect(await call("SALES_MANAGER", "customers")).toBe(200);
    expect(await call("FINANCE_MANAGER", "payments")).toBe(200);
    expect(await call("FINANCE_MANAGER", "vat")).toBe(200);
    expect(await call("INVENTORY_MANAGER", "inventory")).toBe(200);
    expect(await call("SUPER_ADMIN", "template")).toBe(200);
    expect(await call("FINANCE_MANAGER", "template")).toBe(403);
    expect(await call("SUPER_ADMIN", "does-not-exist")).toBe(404);
  });

  it("a suspended or revoked session stops working immediately", async () => {
    await as("SALES_MANAGER");
    expect((await sessionLib.getSessionUser())?.roleKey).toBe("SALES_MANAGER");
    await db.user.update({ where: { id: users.SALES_MANAGER.id }, data: { sessionVersion: { increment: 1 } } });
    expect(await sessionLib.getSessionUser()).toBeNull();
    users.SALES_MANAGER.version += 1;
  });
});

describe("password and email self-service", () => {
  it("requires the current password, enforces strength, and signs out other sessions", async () => {
    const { changePassword, changeEmail } = await import("../app/actions/auth");
    const pwHash = await sessionLib.hashPassword("Old-Password-123");
    const role = await db.role.findUniqueOrThrow({ where: { key: "SALES_MANAGER" } });
    const u = await db.user.create({ data: { kind: "STAFF", email: `pw.${suffix}@example.test`, name: "Pw User", passwordHash: pwHash, roleId: role.id, mustChangePassword: true } });
    const other = await db.user.create({ data: { kind: "STAFF", email: `pw2.${suffix}@example.test`, name: "Other", passwordHash: pwHash, roleId: role.id } });
    users.PW = { id: u.id, version: u.sessionVersion };
    const f = (o: Record<string, string>) => form({ returnTo: "profile", ...o });

    await as("PW");
    expect(await run(() => changePassword(f({ current: "wrong", next: "New-Password-456", confirm: "New-Password-456" })))).toMatch(/error=current/);
    expect(await run(() => changePassword(f({ current: "Old-Password-123", next: "New-Password-456", confirm: "different" })))).toMatch(/error=match/);
    expect(await run(() => changePassword(f({ current: "Old-Password-123", next: "short", confirm: "short" })))).toMatch(/error=/);
    expect(await run(() => changePassword(f({ current: "Old-Password-123", next: "Old-Password-123", confirm: "Old-Password-123" })))).toMatch(/error=same/);
    expect(await run(() => changePassword(f({ current: "Old-Password-123", next: "New-Password-456", confirm: "New-Password-456" })))).toMatch(/\/admin\/profile\?notice=/);

    const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.mustChangePassword).toBe(false);
    expect(await sessionLib.verifyPassword(row.passwordHash, "New-Password-456")).toBe(true);
    expect(await sessionLib.verifyPassword(row.passwordHash, "Old-Password-123")).toBe(false);
    expect(await db.auditLog.count({ where: { action: "auth.password_changed", actorId: u.id } })).toBe(1);
    // an older session (same user, previous version) no longer works
    headersStub.__reset();
    await sessionLib.createSession(u.id, users.PW.version);
    expect(await sessionLib.getSessionUser()).toBeNull();

    // email change: needs password, rejects duplicates, then works
    await as(null);
    await sessionLib.createSession(u.id, row.sessionVersion);
    expect(await run(() => changeEmail(form({ email: other.email, password: "New-Password-456" })))).toMatch(/already in use/);
    expect(await run(() => changeEmail(form({ email: `new.${suffix}@example.test`, password: "nope" })))).toMatch(/incorrect/);
    expect(await run(() => changeEmail(form({ email: `new.${suffix}@example.test`, password: "New-Password-456" })))).toMatch(/notice=/);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe(`new.${suffix}@example.test`);
  });
});
