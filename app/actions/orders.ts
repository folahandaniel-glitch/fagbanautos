"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { startBankTransfer, startPaystackPayment, attachProof, PaymentError } from "@/lib/services/payments";
import { nairaToKobo } from "@/lib/money";
import { PROOF_RULE, UploadError, storeFile, validateUpload } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";

async function ownOrder(orderId: string) {
  const user = await getSessionUser();
  if (!user || !user.customerId) redirect("/account/login");
  const order = await db.order.findFirst({ where: { id: orderId, customerId: user.customerId } });
  if (!order) redirect("/account");
  return { user, order };
}

export async function payMore(formData: FormData) {
  const orderId = String(formData.get("orderId"));
  const { user, order } = await ownOrder(orderId);
  if (!(await rateLimit("pay-more", 10, 600))) redirect(`/order/${order.orderNumber}?notice=rate`);
  const method = String(formData.get("method"));
  const amount = nairaToKobo(Number(String(formData.get("amountNaira")).replace(/[^\d.]/g, "")));
  try {
    if (method === "PAYSTACK") redirect(await startPaystackPayment(order.id, amount, user.email));
    const bank = await db.bankAccount.findFirst({ where: { OR: [{ isActive: true }, { isPlaceholder: true }] }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] });
    if (!bank) redirect(`/order/${order.orderNumber}?notice=no-bank`);
    const pay = await startBankTransfer(order.id, amount, bank.id);
    redirect(`/order/${order.orderNumber}?pay=${pay.id}`);
  } catch (e) {
    if (e instanceof PaymentError) redirect(`/order/${order.orderNumber}?error=${encodeURIComponent(e.message)}`);
    throw e; // redirect() throws NEXT_REDIRECT, which must propagate
  }
}

export async function uploadProof(formData: FormData) {
  const paymentId = String(formData.get("paymentId"));
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) redirect("/account");
  const { user } = await ownOrder(payment.orderId);
  const back = `/order/${payment.order.orderNumber}?pay=${payment.id}`;
  if (!(await rateLimit("proof", 10, 600))) redirect(`${back}&error=${encodeURIComponent("Too many uploads. Please wait.")}`);
  const file = formData.get("proof");
  try {
    if (!(file instanceof File)) throw new UploadError("Please choose a file.");
    const v = await validateUpload(file, PROOF_RULE);
    const url = await storeFile(v.bytes, v.ext, v.mime, "proofs");
    await attachProof(payment.id, url, user.customerId!);
  } catch (e) {
    if (e instanceof UploadError || e instanceof PaymentError) redirect(`${back}&error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect(`/order/${payment.order.orderNumber}?notice=proof-received`);
}
