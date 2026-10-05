import { db } from "../db";
import { randomReference } from "../crypto";
import { audit } from "../audit";
import { payable } from "./orders";
import { getPaystackConfig, initializeTransaction } from "./paystack";

export class PaymentError extends Error {}

export async function remainingToPay(orderId: string): Promise<number> {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  return Math.max(0, payable(o) - Number(o.amountPaid));
}

const MIN_PAYMENT = 100_000; // NGN 1,000 in kobo

/** Create a Paystack payment attempt for an order and return the hosted-checkout URL. Amount is validated server-side. */
export async function startPaystackPayment(orderId: string, amountKobo: number, email: string): Promise<string> {
  const cfg = await getPaystackConfig();
  if (!cfg.enabled || !cfg.secretKey) throw new PaymentError("Card and Paystack payments are not available yet. Please choose bank transfer.");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.vatExemptionStatus === "PENDING_APPROVAL") throw new PaymentError("Your VAT exemption request is awaiting approval. You can pay once it is approved.");
  if (["CANCELLED", "REFUNDED"].includes(order.status)) throw new PaymentError("This order is no longer payable.");
  const remaining = await remainingToPay(orderId);
  if (!Number.isSafeInteger(amountKobo) || amountKobo < Math.min(MIN_PAYMENT, remaining) || amountKobo > remaining) throw new PaymentError("Invalid payment amount.");
  const reference = randomReference("FAGPAY");
  await db.payment.create({ data: { orderId, method: "PAYSTACK", status: "INITIATED", reference, expectedAmount: BigInt(amountKobo) } });
  const base = process.env.APPLICATION_URL ?? "http://localhost:3000";
  const init = await initializeTransaction({ email, amountKobo, reference, callbackUrl: `${base}/pay/paystack/callback`, metadata: { orderNumber: order.orderNumber, orderId } }, cfg.secretKey);
  await db.payment.update({ where: { reference }, data: { status: "PENDING", gatewayReference: init.access_code } });
  return init.authorization_url;
}

/** Create a bank-transfer payment attempt. Money is only credited after a Finance Manager verifies the proof. */
export async function startBankTransfer(orderId: string, amountKobo: number, bankAccountId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.vatExemptionStatus === "PENDING_APPROVAL") throw new PaymentError("Your VAT exemption request is awaiting approval. You can pay once it is approved.");
  if (["CANCELLED", "REFUNDED"].includes(order.status)) throw new PaymentError("This order is no longer payable.");
  const remaining = await remainingToPay(orderId);
  if (!Number.isSafeInteger(amountKobo) || amountKobo < Math.min(MIN_PAYMENT, remaining) || amountKobo > remaining) throw new PaymentError("Invalid payment amount.");
  const bank = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bank) throw new PaymentError("Please choose a bank account.");
  const reference = randomReference("FAGBT");
  return db.payment.create({ data: { orderId, method: "BANK_TRANSFER", status: "INITIATED", reference, expectedAmount: BigInt(amountKobo), bankAccountId } });
}

export async function attachProof(paymentId: string, proofUrl: string, customerId: string) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  if (p.order.customerId !== customerId) throw new PaymentError("Not allowed.");
  if (p.method !== "BANK_TRANSFER" || !["INITIATED", "CLARIFICATION_REQUESTED", "REJECTED"].includes(p.status)) throw new PaymentError("Proof cannot be attached to this payment.");
  await db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { proofUrl, status: "AWAITING_VERIFICATION", rejectionReason: null } });
    if (["PENDING_PAYMENT"].includes(p.order.status)) {
      await tx.order.update({ where: { id: p.orderId }, data: { status: "PAYMENT_VERIFICATION" } });
      await tx.orderStateHistory.create({ data: { orderId: p.orderId, fromStatus: p.order.status, toStatus: "PAYMENT_VERIFICATION", note: "Proof of payment uploaded" } });
    }
    await audit({ action: "payment.proof_uploaded", targetType: "Payment", targetId: paymentId }, tx);
  });
}
