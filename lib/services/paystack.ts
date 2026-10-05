import { db } from "../db";
import { audit } from "../audit";
import { decryptSecret } from "../crypto";
import { applyVerifiedPayment } from "./orders";

const API = "https://api.paystack.co";

export interface PaystackConfig { enabled: boolean; mode: "test" | "live"; publicKey: string | null; secretKey: string | null; currency: string; source: "env" | "database" | "none" }

/** Environment variables take precedence; otherwise the (encrypted) key saved by the Super Admin. The secret never leaves the server. */
export async function getPaystackConfig(): Promise<PaystackConfig> {
  const row = await db.paymentGateway.findUnique({ where: { key: "paystack" } });
  const envSecret = process.env.PAYSTACK_SECRET_KEY || null;
  let secret = envSecret;
  let source: PaystackConfig["source"] = envSecret ? "env" : "none";
  if (!secret && row?.secretKeyEnc) {
    try { secret = decryptSecret(row.secretKeyEnc); source = "database"; } catch (e) { console.error("[paystack] stored secret cannot be decrypted", e); }
  }
  const enabledSetting = await db.setting.findUnique({ where: { key: "payments.paystackEnabled" } });
  return {
    enabled: !!secret && (row?.enabled === true || enabledSetting?.value === true),
    mode: (row?.mode as "test" | "live") ?? "test",
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || row?.publicKey || null,
    secretKey: secret,
    currency: row?.currency ?? "NGN",
    source,
  };
}

type Fetcher = typeof fetch;

export async function initializeTransaction(opts: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }, secretKey: string, f: Fetcher = fetch) {
  const res = await f(`${API}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: opts.email, amount: opts.amountKobo, currency: "NGN", reference: opts.reference, callback_url: opts.callbackUrl, metadata: opts.metadata }),
    cache: "no-store",
  });
  const json = (await res.json()) as { status: boolean; message: string; data?: { authorization_url: string; access_code: string; reference: string } };
  if (!res.ok || !json.status || !json.data) throw new Error(`Paystack initialize failed: ${json.message}`);
  return json.data;
}

export interface VerifyData { status: string; reference: string; amount: number; currency: string; id?: number; channel?: string; gateway_response?: string }

export async function verifyTransaction(reference: string, secretKey: string, f: Fetcher = fetch): Promise<VerifyData> {
  const res = await f(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" });
  const json = (await res.json()) as { status: boolean; message: string; data?: VerifyData };
  if (!res.ok || !json.status || !json.data) throw new Error(`Paystack verify failed: ${json.message}`);
  return json.data;
}

export type ProcessResult = "credited" | "duplicate" | "failed" | "pending" | "mismatch" | "unknown";

/**
 * Server-side payment confirmation. Never trusts a webhook body or a browser callback:
 * always re-queries Paystack, then checks status, currency, reference and exact amount against what we expected.
 */
export async function processPaystackReference(reference: string, f: Fetcher = fetch): Promise<ProcessResult> {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.method !== "PAYSTACK") return "unknown";
  if (payment.status === "SUCCESS") return "duplicate";
  const cfg = await getPaystackConfig();
  if (!cfg.secretKey) throw new Error("Paystack is not configured");
  const data = await verifyTransaction(reference, cfg.secretKey, f);

  if (data.status === "success") {
    if (data.reference !== reference || data.currency !== "NGN" || BigInt(data.amount) !== payment.expectedAmount) {
      await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rejectionReason: `Amount/currency mismatch (paid ${data.amount} ${data.currency}, expected ${payment.expectedAmount})`, rawEvent: JSON.parse(JSON.stringify(data)) } });
      await audit({ action: "payment.mismatch", targetType: "Payment", targetId: payment.id, after: { expected: Number(payment.expectedAmount), got: data.amount, currency: data.currency } });
      return "mismatch";
    }
    const r = await applyVerifiedPayment({ paymentId: payment.id, paidAmount: data.amount, gatewayReference: String(data.id ?? reference), note: "Paystack verified" });
    await db.payment.update({ where: { id: payment.id }, data: { channel: data.channel, rawEvent: JSON.parse(JSON.stringify(data)) } });
    return r.duplicate ? "duplicate" : "credited";
  }
  if (["failed", "abandoned", "reversed"].includes(data.status)) {
    await db.payment.update({ where: { id: payment.id }, data: { status: data.status === "reversed" ? "REVERSED" : "FAILED", rejectionReason: data.gateway_response ?? data.status } });
    return "failed";
  }
  await db.payment.update({ where: { id: payment.id }, data: { status: "PENDING" } });
  return "pending";
}
