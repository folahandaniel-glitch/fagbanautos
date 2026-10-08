import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { hash, verify } from "@node-rs/argon2";
import { cache } from "react";
import { db } from "../db";
import { roleKeys } from "../rbac/permissions";

const COOKIE = "fagdan_session";
const MAX_AGE_S = 60 * 60 * 12; // 12 hours

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (min 32 chars)");
  return new TextEncoder().encode(s);
}

// Argon2id parameters (OWASP-recommended minimums: m=19MiB, t=2, p=1)
const ARGON = { algorithm: 2 as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => hash(pw, ARGON);
export const verifyPassword = (hashed: string, pw: string) => verify(hashed, pw);

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "Use upper case, lower case and a number.";
  return null;
}

/** Staff sessions are shorter than customer sessions; the length is a setting (hours). */
export async function staffSessionSeconds(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "security.staffSessionHours" } });
  const h = Number(row?.value ?? 12);
  return Math.round((Number.isFinite(h) ? Math.min(168, Math.max(1, h)) : 12) * 3600);
}

export async function createSession(userId: string, sessionVersion: number, maxAgeS: number = MAX_AGE_S): Promise<void> {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeS}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: maxAgeS });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  kind: "STAFF" | "CUSTOMER";
  roleKey: string | null;
  permissions: Set<string>;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  customerId: string | null;
}

/** Resolved once per request. Re-checks the DB so suspension and session revocation take effect immediately. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const id = payload.sub;
    if (!id) return null;
    const u = await db.user.findUnique({ where: { id }, include: { role: true, customer: { select: { id: true } } } });
    if (!u || u.status !== "ACTIVE" || u.sessionVersion !== payload.sv) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      kind: u.kind,
      roleKey: u.role?.key ?? null,
      permissions: new Set(u.role ? roleKeys(u.role.key) : []),
      mustChangePassword: u.mustChangePassword,
      totpEnabled: u.totpEnabled,
      customerId: u.customer?.id ?? null,
    };
  } catch {
    return null;
  }
});
