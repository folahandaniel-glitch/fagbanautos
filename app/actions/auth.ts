"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyTotp } from "@/lib/totp";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, destroySession, getSessionUser, hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
// A real hash (generated once) used to equalise timing when the account does not exist (prevents user enumeration by response time).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("timing-equaliser-password"));

const safeNext = (n: FormDataEntryValue | null, fallback: string) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/admin/login") ? s : fallback;
};

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(10).max(128),
});

export async function registerCustomer(formData: FormData) {
  if (!(await rateLimit("register", 5, 900))) redirect("/account/register?error=rate");
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  const next = safeNext(formData.get("next"), "/account");
  if (!parsed.success) redirect("/account/register?error=invalid");
  const weak = validatePasswordStrength(parsed.data.password);
  if (weak) redirect(`/account/register?error=${encodeURIComponent(weak)}`);
  if (formData.get("consent") !== "on") redirect("/account/register?error=consent");
  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) redirect("/account/register?error=exists");
  const user = await db.user.create({
    data: { kind: "CUSTOMER", email: parsed.data.email, name: parsed.data.name, phone: parsed.data.phone, passwordHash: await hashPassword(parsed.data.password), customer: { create: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, marketingConsent: formData.get("marketing") === "on" } } },
  });
  await db.consentRecord.create({ data: { subject: user.email, purpose: "terms-and-privacy", granted: true } });
  await createSession(user.id, user.sessionVersion);
  redirect(next);
}

export async function login(formData: FormData) {
  const portal = formData.get("portal") === "admin" ? "admin" : "account";
  const failUrl = portal === "admin" ? "/admin/login" : "/account/login";
  const nextDefault = portal === "admin" ? "/admin" : "/account";
  if (!(await rateLimit(`login:${portal}`, 10, 600))) redirect(`${failUrl}?error=rate`);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(formData.get("next"), nextDefault);
  const user = email ? await db.user.findUnique({ where: { email } }) : null;

  const locked = user?.lockedUntil && user.lockedUntil > new Date();
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password).catch(() => false);
  if (!user || !ok || locked || user.status !== "ACTIVE" || (portal === "admin" && user.kind !== "STAFF")) {
    if (user && !ok) {
      const fails = user.failedLogins + 1;
      await db.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined } });
      await audit({ actorId: user.id, action: "auth.login_failed", targetType: "User", targetId: user.id, after: { fails } });
    }
    redirect(`${failUrl}?error=${locked ? "locked" : "invalid"}`);
  }
  if (user.totpEnabled && user.totpSecretEnc) {
    if (!code) redirect(`${failUrl}?error=code&email=${encodeURIComponent(email)}`);
    if (!verifyTotp(code, decryptSecret(user.totpSecretEnc))) {
      await audit({ actorId: user.id, action: "auth.2fa_failed", targetType: "User", targetId: user.id });
      redirect(`${failUrl}?error=code&email=${encodeURIComponent(email)}`);
    }
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id, user.sessionVersion);
  await audit({ actorId: user.id, action: "auth.login", targetType: "User", targetId: user.id });
  if (user.kind === "STAFF") redirect(user.mustChangePassword ? "/admin/change-password" : portal === "admin" ? next : "/admin");
  redirect(next);
}

export async function logout() {
  const u = await getSessionUser();
  await destroySession();
  if (u) await audit({ actorId: u.id, action: "auth.logout", targetType: "User", targetId: u.id });
  redirect("/");
}

export async function changePassword(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(row.passwordHash, current).catch(() => false))) redirect("/admin/change-password?error=current");
  if (next !== confirm) redirect("/admin/change-password?error=match");
  const weak = validatePasswordStrength(next);
  if (weak) redirect(`/admin/change-password?error=${encodeURIComponent(weak)}`);
  if (await verifyPassword(row.passwordHash, next).catch(() => false)) redirect("/admin/change-password?error=same");
  const updated = await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } } });
  await createSession(updated.id, updated.sessionVersion); // other sessions are revoked by the version bump
  await audit({ actorId: u.id, action: "auth.password_changed", targetType: "User", targetId: u.id });
  redirect(u.kind === "STAFF" ? "/admin" : "/account");
}
