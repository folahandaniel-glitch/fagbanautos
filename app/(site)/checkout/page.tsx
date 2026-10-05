import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getCart } from "@/lib/cart";
import { db } from "@/lib/db";
import { getPaystackConfig } from "@/lib/services/paystack";
import { getSettings } from "@/lib/settings";
import { quoteAction } from "@/app/actions/checkout";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(sp.mode === "installment" ? "/checkout?mode=installment" : "/checkout")}`);
  if (user.kind === "STAFF") redirect("/admin");
  const cart = await getCart();
  if (!cart || cart.items.filter((i) => !i.savedForLater).length === 0) redirect("/cart");
  const customer = user.customerId ? await db.customer.findUnique({ where: { id: user.customerId } }) : null;
  const mode = sp.mode === "installment" ? "INSTALLMENT" : "OUTRIGHT";
  const [pay, s, banks] = await Promise.all([getPaystackConfig(), getSettings(), db.bankAccount.count({ where: { OR: [{ isActive: true }, { isPlaceholder: true }] } })]);
  const initial = await quoteAction({ mode, deliveryMethod: "PICKUP", depositNaira: 0 });
  return (
    <CheckoutClient
      user={{ name: user.name, email: user.email, phone: customer?.phone ?? "" }}
      defaultMode={mode}
      initial={initial}
      paystackEnabled={pay.enabled}
      bankEnabled={s["payments.bankTransferEnabled"] === true && banks > 0}
      vatPolicy={{ requireReason: s["vat.requireReason"] === true, requireApproval: s["vat.requireApproval"] === true }}
    />
  );
}
