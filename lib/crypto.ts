import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

/**
 * Envelope-style secret storage: AES-256-GCM with a master key from SETTINGS_ENCRYPTION_KEY
 * (any string; stretched with SHA-256). Output format: v1:<iv>:<tag>:<ciphertext> (base64url).
 * Secrets are write-only in the UI and only ever shown masked.
 */
function masterKey(): Buffer {
  const k = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!k || k.length < 16) throw new Error("SETTINGS_ENCRYPTION_KEY must be set (min 16 chars)");
  return createHash("sha256").update(k).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(payload: string): string {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Malformed secret payload");
  const d = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export function maskSecret(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••••••${plain.slice(-4)}`;
}

/** Paystack: HMAC-SHA512 of the RAW body with the secret key, hex; compared in constant time. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !secretKey) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomReference(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export function randomPassword(len = 16): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const buf = randomBytes(len);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}
