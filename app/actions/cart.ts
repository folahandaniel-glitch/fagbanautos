"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureCartKey, getCartKey } from "@/lib/cart";

const addSchema = z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(99).default(1) });

export async function addToCart(formData: FormData) {
  const { productId, quantity } = addSchema.parse({ productId: formData.get("productId"), quantity: formData.get("quantity") ?? 1 });
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, type: true, status: true, stockOnHand: true, stockReserved: true, allowBackorder: true } });
  if (!product || product.status !== "ACTIVE" || product.type === "SERVICE") redirect("/cart?error=unavailable");
  const key = await ensureCartKey();
  const cart = await db.cart.upsert({ where: { sessionKey: key }, create: { sessionKey: key }, update: {} });
  const qty = product.type === "VEHICLE" ? 1 : quantity; // vehicles can never exceed quantity 1
  const existing = await db.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
  const next = product.type === "VEHICLE" ? 1 : Math.min(99, (existing?.quantity ?? 0) + qty);
  await db.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity: qty },
    update: { quantity: next, savedForLater: false },
  });
  revalidatePath("/cart");
  if (formData.get("buyNow") === "1") redirect(formData.get("mode") === "installment" ? "/checkout?mode=installment" : "/checkout");
  redirect("/cart");
}

export async function updateCartItem(formData: FormData) {
  const itemId = String(formData.get("itemId"));
  const intent = String(formData.get("intent"));
  const key = await getCartKey();
  if (!key) return;
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { sessionKey: key } }, include: { product: true } });
  if (!item) return;
  if (intent === "remove") await db.cartItem.delete({ where: { id: itemId } });
  else if (intent === "save") await db.cartItem.update({ where: { id: itemId }, data: { savedForLater: true } });
  else if (intent === "restore") await db.cartItem.update({ where: { id: itemId }, data: { savedForLater: false } });
  else if (intent === "inc" && item.product.type !== "VEHICLE") await db.cartItem.update({ where: { id: itemId }, data: { quantity: Math.min(99, item.quantity + 1) } });
  else if (intent === "dec") {
    if (item.quantity <= 1) await db.cartItem.delete({ where: { id: itemId } });
    else await db.cartItem.update({ where: { id: itemId }, data: { quantity: item.quantity - 1 } });
  }
  revalidatePath("/cart");
}
