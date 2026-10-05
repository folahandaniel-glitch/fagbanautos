import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { can, roleKeys, ROLES, SUPER_ONLY, ALL_PERMISSION_KEYS, grantsToKeys } from "../lib/rbac/permissions";
import { encryptSecret, decryptSecret, maskSecret, verifyPaystackSignature } from "../lib/crypto";

beforeAll(() => { process.env.SETTINGS_ENCRYPTION_KEY = "test-master-key-0123456789"; });

describe("RBAC matrix", () => {
  it("has the ten staff roles plus super admin and customer", () => {
    const staff = ROLES.filter((r) => r.key !== "SUPER_ADMIN" && r.key !== "CUSTOMER");
    expect(staff).toHaveLength(10);
  });
  it("super admin holds every permission", () => {
    expect(roleKeys("SUPER_ADMIN").length).toBe(ALL_PERMISSION_KEYS.length);
  });
  it("no non-super role holds a financial-authority key", () => {
    for (const r of ROLES.filter((x) => x.key !== "SUPER_ADMIN")) {
      for (const k of SUPER_ONLY) expect(can(r.key, k), `${r.key} must not have ${k}`).toBe(false);
    }
  });
  it("only super admin can override payments, VAT, bank, paystack", () => {
    for (const k of ["settings:vat", "settings:bank", "settings:paystack", "payments:override", "release:override", "settings:installment"]) {
      expect(can("SUPER_ADMIN", k)).toBe(true);
      expect(can("FINANCE_MANAGER", k)).toBe(false);
      expect(can("TECH_ADMIN", k)).toBe(false);
    }
  });
  it("separation of duties", () => {
    expect(can("FINANCE_MANAGER", "payments:verify")).toBe(true);
    expect(can("INVENTORY_MANAGER", "payments:verify")).toBe(false);
    expect(can("MARKETING_MANAGER", "inventory:edit")).toBe(false);
    expect(can("CUSTOMER", "orders:view")).toBe(false);
    expect(can(null, "orders:view")).toBe(false);
  });
  it("rejects unknown keys in matrix", () => {
    expect(() => grantsToKeys(["nope:view"])).toThrow();
  });
});

describe("secret encryption", () => {
  it("round-trips and never stores plaintext", () => {
    const enc = encryptSecret("sk_test_abcdef123456");
    expect(enc).not.toContain("sk_test");
    expect(decryptSecret(enc)).toBe("sk_test_abcdef123456");
  });
  it("is non-deterministic and tamper-evident", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
    const enc = encryptSecret("hello");
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
  it("masks", () => expect(maskSecret("sk_test_abcd1234")).toBe("••••••••1234"));
});

describe("paystack signature", () => {
  const secret = "sk_test_secret";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "R1", amount: 1000 } });
  const sig = createHmac("sha512", secret).update(body).digest("hex");
  it("accepts a valid signature", () => expect(verifyPaystackSignature(body, sig, secret)).toBe(true));
  it("rejects wrong secret, tampered body, missing header", () => {
    expect(verifyPaystackSignature(body, sig, "other")).toBe(false);
    expect(verifyPaystackSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body, "abc", secret)).toBe(false);
  });
});
