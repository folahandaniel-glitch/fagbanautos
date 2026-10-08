import { createHash } from "node:crypto";

/**
 * Checks a password against the public "Have I Been Pwned" list using k-anonymity: only the first 5 characters of the
 * SHA-1 hash leave the server, never the password. If the service is unreachable the check is skipped (fails open).
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  try {
    const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!res.ok) return false;
    const suffix = sha.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix && Number(count) > 0) return true;
    }
  } catch { /* unreachable: skip */ }
  return false;
}

export const BREACH_MESSAGE = "That password has appeared in known data breaches. Please choose a different one.";
