import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "./db";

const COOKIE = "fagdan_cart";

/** Cart is keyed by an opaque random cookie; prices are never stored in it (the server re-prices everything). */
export async function getCartKey(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function ensureCartKey(): Promise<string> {
  const jar = await cookies();
  let key = jar.get(COOKIE)?.value;
  if (!key) {
    key = randomBytes(18).toString("base64url");
    jar.set(COOKIE, key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return key;
}

export async function getCart() {
  const key = await getCartKey();
  if (!key) return null;
  return db.cart.findUnique({
    where: { sessionKey: key },
    include: { items: { include: { product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true } } }, orderBy: { id: "asc" } } },
  });
}

export async function cartCount(): Promise<number> {
  const key = await getCartKey();
  if (!key) return 0;
  const r = await db.cartItem.aggregate({ where: { cart: { sessionKey: key }, savedForLater: false }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}
