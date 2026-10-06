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
  // Form may live on the dedicated page or inside Profile; only these two internal destinations are allowed.
  const page = formData.get("returnTo") === "profile" ? "/admin/profile" : "/admin/change-password";
  const fail = (code: string): never => redirect(`${page}?error=${encodeURIComponent(code)}`);
  if (!(await rateLimit("pw-change", 6, 600))) fail("Too many attempts. Please wait a few minutes.");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(row.passwordHash, current).catch(() => false))) fail("current");
  if (next !== confirm) fail("match");
  const weak = validatePasswordStrength(next);
  if (weak) fail(weak);
  if (await verifyPassword(row.passwordHash, next).catch(() => false)) fail("same");
  const updated = await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } } });
  await createSession(updated.id, updated.sessionVersion); // other sessions are revoked by the version bump
  await audit({ actorId: u.id, action: "auth.password_changed", targetType: "User", targetId: u.id });
  if (page === "/admin/profile") redirect("/admin/profile?notice=" + encodeURIComponent("Password changed. Other devices have been signed out."));
  redirect(u.kind === "STAFF" ? "/admin" : "/account");
}

/** Change the sign-in email. Requires the current password; the new address must be unused. */
export async function changeEmail(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  const back = (kind: "notice" | "error", msg: string): never => redirect(`/admin/profile?${kind}=${encodeURIComponent(msg)}`);
  if (!(await rateLimit("email-change", 6, 600))) back("error", "Too many attempts. Please wait a few minutes.");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!z.string().email().max(120).safeParse(email).success) back("error", "Enter a valid email address.");
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(row.passwordHash, password).catch(() => false))) back("error", "Your password is incorrect.");
  if (email === row.email) back("error", "That is already your email address.");
  if (await db.user.findUnique({ where: { email } })) back("error", "That email is already in use.");
  await db.user.update({ where: { id: u.id }, data: { email } });
  if (row.kind === "CUSTOMER") await db.customer.updateMany({ where: { userId: u.id }, data: { email } });
  await audit({ actorId: u.id, action: "auth.email_changed", targetType: "User", targetId: u.id, before: { email: row.email }, after: { email } });
  back("notice", `Sign-in email changed to ${email}.`);
}
