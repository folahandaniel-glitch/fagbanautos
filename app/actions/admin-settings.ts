"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, requireAnyPermission, AuthError } from "@/lib/auth/guard";
import { getSettings, setSetting } from "@/lib/settings";
import { SETTING_DEFS, settingPermission } from "@/lib/settings-defaults";
import { encryptSecret, maskSecret } from "@/lib/crypto";
import { verifyTransaction, getPaystackConfig } from "@/lib/services/paystack";

const FINANCIAL = ["vat", "installment", "payments", "currency", "shipping"];

function go(path: string, kind: "notice" | "error", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
}

async function need(perm: string, path: string) {
  try { return await requirePermission(perm); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
}

async function needAny(perms: string[], path: string) {
  try { return await requireAnyPermission(...perms); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
}

export async function saveSettings(formData: FormData) {
  const group = String(formData.get("group"));
  const path = `/admin/settings?group=${group}`;
  const reason = String(formData.get("reason") ?? "").trim();
  const user = await needAny(["settings:view", "content:edit"], path);
  const current = await getSettings();
  const keys = Object.entries(SETTING_DEFS).filter(([, d]) => d.group === group).map(([k]) => k);
  let changed = 0;
  for (const key of keys) {
    const def = SETTING_DEFS[key];
    const submitted = formData.getAll(`s:${key}`);
    if (submitted.length === 0) continue;
    const raw = String(submitted[submitted.length - 1]);
    let value: unknown = raw;
    if (def.type === "number") { value = Number(raw); if (!Number.isFinite(value as number)) go(path, "error", `${def.label} must be a number.`); }
    else if (def.type === "boolean") value = raw === "true";
    if (JSON.stringify(value) === JSON.stringify(current[key])) continue;
    const perm = settingPermission(key);
    if (!user.permissions.has(perm)) go(path, "error", `Only an authorised role can change "${def.label}".`);
    if (FINANCIAL.includes(group) && reason.length < 5) go(path, "error", "Please give a reason for this financial setting change.");
    if (key === "vat.rateBps" && ((value as number) < 0 || (value as number) > 5000)) go(path, "error", "VAT must be between 0% and 50%.");
    if (key === "installment.releaseThresholdBps" && ((value as number) < 1 || (value as number) > 10000)) go(path, "error", "Release threshold must be between 0.01% and 100%.");
    await setSetting(key, value, user.id, reason || undefined);
    changed++;
  }
  revalidatePath("/", "layout");
  go(path, "notice", changed ? `${changed} setting${changed > 1 ? "s" : ""} saved.` : "Nothing changed.");
}

export async function savePaystack(formData: FormData) {
  const path = "/admin/settings/paystack";
  const user = await need("settings:paystack", path);
  const mode = formData.get("mode") === "live" ? "live" : "test";
  const enabled = formData.get("enabled") === "on";
  const publicKey = String(formData.get("publicKey") ?? "").trim();
  const secret = String(formData.get("secretKey") ?? "").trim();
  const action = String(formData.get("action") ?? "save");
  if (publicKey && !/^pk_(test|live)_[A-Za-z0-9]+$/.test(publicKey)) go(path, "error", "That does not look like a Paystack public key (pk_test_… or pk_live_…).");
  if (secret && !/^sk_(test|live)_[A-Za-z0-9]+$/.test(secret)) go(path, "error", "That does not look like a Paystack secret key (sk_test_… or sk_live_…).");
  if (secret && !secret.startsWith(`sk_${mode}_`)) go(path, "error", `The secret key does not match ${mode} mode.`);
  const before = await db.paymentGateway.findUnique({ where: { key: "paystack" } });
  await db.paymentGateway.upsert({
    where: { key: "paystack" },
    create: { key: "paystack", name: "Paystack", enabled, mode, publicKey: publicKey || null, secretKeyEnc: secret ? encryptSecret(secret) : null },
    update: { enabled, mode, publicKey: publicKey || before?.publicKey || null, ...(secret ? { secretKeyEnc: encryptSecret(secret) } : {}) },
  });
  await setSetting("payments.paystackEnabled", enabled, user.id, "Paystack configuration saved");
  // Never write key material to the audit log: only what changed, and a masked hint.
  await audit({ actorId: user.id, action: "settings.paystack.update", targetType: "PaymentGateway", targetId: "paystack", before: { enabled: before?.enabled, mode: before?.mode, hasSecret: !!before?.secretKeyEnc }, after: { enabled, mode, secretReplaced: !!secret, secretHint: secret ? maskSecret(secret) : undefined } });
  if (action === "test") {
    const cfg = await getPaystackConfig();
    if (!cfg.secretKey) go(path, "error", "No secret key is configured.");
    try {
      await verifyTransaction("fagdan-config-test-nonexistent", cfg.secretKey); // 404 body proves the key authenticates
      go(path, "notice", "Configuration saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/not found|Transaction reference not found/i.test(msg)) go(path, "notice", "Configuration saved and the secret key authenticated successfully with Paystack.");
      if (/invalid key|unauthor/i.test(msg)) go(path, "error", "Paystack rejected the secret key. Please check it and try again.");
      go(path, "error", "Could not reach Paystack to test the key. It was saved; try the test again.");
    }
  }
  go(path, "notice", "Paystack configuration saved.");
}

export async function clearPaystackSecret() {
  const path = "/admin/settings/paystack";
  const user = await need("settings:paystack", path);
  await db.paymentGateway.update({ where: { key: "paystack" }, data: { secretKeyEnc: null, enabled: false } });
  await setSetting("payments.paystackEnabled", false, user.id, "Paystack secret removed");
  await audit({ actorId: user.id, action: "settings.paystack.secret_removed", targetType: "PaymentGateway", targetId: "paystack" });
  go(path, "notice", "Secret key removed and Paystack disabled.");
}

export async function saveBank(formData: FormData) {
  const path = "/admin/settings/banks";
  const user = await need("settings:bank", path);
  const id = String(formData.get("id") ?? "");
  const data = {
    bankName: String(formData.get("bankName") ?? "").trim(), accountName: String(formData.get("accountName") ?? "").trim(), accountNumber: String(formData.get("accountNumber") ?? "").trim(),
    accountType: String(formData.get("accountType") ?? "Current").trim(), branch: String(formData.get("branch") ?? "").trim() || null, bankCode: String(formData.get("bankCode") ?? "").trim() || null,
    currency: String(formData.get("currency") ?? "NGN").trim().toUpperCase(), instructions: String(formData.get("instructions") ?? "").trim() || null, isActive: formData.get("isActive") === "on",
  };
  if (!data.bankName || !data.accountName) go(path, "error", "Bank name and account name are required.");
  if (!/^\d{10}$/.test(data.accountNumber)) go(path, "error", "A Nigerian NUBAN account number has exactly 10 digits.");
  const isPlaceholderNumber = /^0{10}$/.test(data.accountNumber);
  if (data.isActive && isPlaceholderNumber) go(path, "error", "Placeholder account numbers cannot be activated.");
  const before = id ? await db.bankAccount.findUnique({ where: { id } }) : null;
  const row = id
    ? await db.bankAccount.update({ where: { id }, data: { ...data, isPlaceholder: isPlaceholderNumber } })
    : await db.bankAccount.create({ data: { ...data, isPlaceholder: isPlaceholderNumber } });
  await audit({ actorId: user.id, action: id ? "settings.bank.update" : "settings.bank.create", targetType: "BankAccount", targetId: row.id, before: before ? { bankName: before.bankName, accountNumber: before.accountNumber, isActive: before.isActive } : undefined, after: { bankName: row.bankName, accountNumber: row.accountNumber, isActive: row.isActive } });
  go(path, "notice", "Bank account saved.");
}

export async function deleteBank(formData: FormData) {
  const path = "/admin/settings/banks";
  const user = await need("settings:bank", path);
  const id = String(formData.get("id"));
  const used = await db.payment.count({ where: { bankAccountId: id } });
  if (used > 0) {
    await db.bankAccount.update({ where: { id }, data: { isActive: false } });
    await audit({ actorId: user.id, action: "settings.bank.deactivate", targetType: "BankAccount", targetId: id, reason: "In use by payments; deactivated instead of deleted" });
    go(path, "notice", "This account has payments against it, so it was deactivated rather than deleted.");
  }
  await db.bankAccount.delete({ where: { id } });
  await audit({ actorId: user.id, action: "settings.bank.delete", targetType: "BankAccount", targetId: id });
  go(path, "notice", "Bank account deleted.");
}
