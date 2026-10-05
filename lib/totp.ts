import { generateSecret, generateURI, verifySync } from "otplib";

/** TOTP helpers for staff two-factor authentication. Secrets are stored encrypted (see lib/crypto.ts). */
export const newTotpSecret = (): string => generateSecret();

export const totpUri = (email: string, secret: string): string => generateURI({ issuer: "FAGDAN", label: email, secret });

/** Accepts the current code and one step either side (30s) to tolerate clock drift. */
export function verifyTotp(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return verifySync({ secret, token, epochTolerance: 30 }).valid === true;
  } catch {
    return false;
  }
}
