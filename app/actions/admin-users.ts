"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, AuthError } from "@/lib/auth/guard";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth/session";
import { randomPassword, encryptSecret, decryptSecret } from "@/lib/crypto";
import { newTotpSecret, verifyTotp } from "@/lib/totp";
import { cookies } from "next/headers";

function go(path: string, kind: "notice" | "error", msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);
}
async function need(perm: string, path: string) {
  try { return await requirePermission(perm); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}?error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
}

const createSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), roleKey: z.string().min(2) });

/** Creates a staff account with a one-time password (shown once, forced change at first login). */
export async function createStaff(formData: FormData) {
  const path = "/admin/users";
  const actor = await need("users:manage_admins", path);
  const d = createSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) go(path, "error", "Please enter a valid name, email and role.");
  const role = await db.role.findUnique({ where: { key: d.data.roleKey } });
  if (!role || role.key === "CUSTOMER") go(path, "error", "Choose a staff role.");
  if (await db.user.findUnique({ where: { email: d.data.email } })) go(path, "error", "That email is already registered.");
  const pw = randomPassword(16);
  const u = await db.user.create({ data: { kind: "STAFF", email: d.data.email, name: d.data.name, passwordHash: await hashPassword(pw), roleId: role.id, mustChangePassword: true } });
  await audit({ actorId: actor.id, action: "admin.create", targetType: "User", targetId: u.id, after: { email: u.email, role: role.key } });
  // The one-time password is passed in a short-lived, httpOnly cookie so it is shown once and never lands in a URL or log.
  (await cookies()).set("fagdan_otp", `${u.email}|${pw}`, { httpOnly: true, sameSite: "strict", path: "/admin/users", maxAge: 60, secure: process.env.NODE_ENV === "production" });
  revalidatePath(path);
  go(path, "notice", `Staff account created for ${u.email}. Copy the one-time password below now.`);
}

export async function updateStaff(formData: FormData) {
  const path = "/admin/users";
  const actor = await need("users:manage_admins", path);
  const id = String(formData.get("id"));
  const intent = String(formData.get("intent"));
  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!target || target.kind !== "STAFF") go(path, "error", "User not found.");
  if (target.id === actor.id && ["suspend", "role"].includes(intent)) go(path, "error", "You cannot suspend or change the role of your own account.");
  if (target.role?.key === "SUPER_ADMIN" && target.id !== actor.id) go(path, "error", "Other Super Admin accounts cannot be modified here.");
  if (intent === "role") {
    const role = await db.role.findUnique({ where: { key: String(formData.get("roleKey")) } });
    if (!role || role.key === "CUSTOMER") go(path, "error", "Invalid role.");
    await db.user.update({ where: { id }, data: { roleId: role.id, sessionVersion: { increment: 1 } } });
    await audit({ actorId: actor.id, action: "admin.role_change", targetType: "User", targetId: id, before: { role: target.role?.key }, after: { role: role.key } });
  } else if (intent === "suspend" || intent === "activate") {
    await db.user.update({ where: { id }, data: { status: intent === "suspend" ? "SUSPENDED" : "ACTIVE", sessionVersion: { increment: 1 } } });
    await audit({ actorId: actor.id, action: `admin.${intent}`, targetType: "User", targetId: id });
  } else if (intent === "reset") {
    const pw = randomPassword(16);
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), mustChangePassword: true, failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } } });
    await audit({ actorId: actor.id, action: "admin.password_reset", targetType: "User", targetId: id });
    (await cookies()).set("fagdan_otp", `${target.email}|${pw}`, { httpOnly: true, sameSite: "strict", path: "/admin/users", maxAge: 60, secure: process.env.NODE_ENV === "production" });
  } else if (intent === "reset2fa") {
    await db.user.update({ where: { id }, data: { totpEnabled: false, totpSecretEnc: null, sessionVersion: { increment: 1 } } });
    await audit({ actorId: actor.id, action: "admin.2fa_reset", targetType: "User", targetId: id });
  }
  revalidatePath(path);
  go(path, "notice", "Staff account updated.");
}

export async function begin2fa() {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  const secret = newTotpSecret();
  await db.user.update({ where: { id: u.id }, data: { totpSecretEnc: encryptSecret(secret), totpEnabled: false } });
  redirect("/admin/profile?setup=1");
}

export async function confirm2fa(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!row.totpSecretEnc) go("/admin/profile", "error", "Start setup first.");
  if (!verifyTotp(String(formData.get("code") ?? "").replace(/\s/g, ""), decryptSecret(row.totpSecretEnc))) go("/admin/profile?setup=1", "error", "That code is not correct. Try the next one.");
  await db.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
  await audit({ actorId: u.id, action: "auth.2fa_enabled", targetType: "User", targetId: u.id });
  go("/admin/profile", "notice", "Two-factor authentication is now on.");
}

export async function disable2fa(formData: FormData) {
  const u = await getSessionUser();
  if (!u) redirect("/admin/login");
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await verifyPassword(row.passwordHash, String(formData.get("password") ?? "")).catch(() => false))) go("/admin/profile", "error", "Incorrect password.");
  await db.user.update({ where: { id: u.id }, data: { totpEnabled: false, totpSecretEnc: null } });
  await audit({ actorId: u.id, action: "auth.2fa_disabled", targetType: "User", targetId: u.id });
  go("/admin/profile", "notice", "Two-factor authentication turned off.");
}
