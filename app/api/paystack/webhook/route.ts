import { NextRequest } from "next/server";
import { verifyPaystackSignature } from "@/lib/crypto";
import { getPaystackConfig, processPaystackReference } from "@/lib/services/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paystack webhook.
 * 1. Read the RAW body (never re-serialised JSON).
 * 2. Verify x-paystack-signature = HMAC-SHA512(raw body, secret key) in constant time.
 * 3. Do NOT trust the body: re-verify the transaction with Paystack's API before crediting anything.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const cfg = await getPaystackConfig();
  if (!cfg.secretKey || !verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), cfg.secretKey)) {
    return new Response("invalid signature", { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const ref = event.data?.reference;
  if (ref && event.event?.startsWith("charge.")) {
    try {
      await processPaystackReference(ref);
    } catch (err) {
      console.error("[paystack webhook] processing failed", ref, err);
      return new Response("processing error", { status: 500 }); // Paystack will retry
    }
  }
  return new Response("ok", { status: 200 });
}
