import type { Metadata } from "next";
import Link from "next/link";
import { getCart } from "@/lib/cart";
import { buildQuote, OrderError } from "@/lib/services/orders";
import { formatNaira } from "@/lib/money";
import { SmartImage } from "@/components/ui/media";
import { updateCartItem } from "@/app/actions/cart";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const cart = await getCart();
  const active = (cart?.items ?? []).filter((i) => !i.savedForLater);
  const saved = (cart?.items ?? []).filter((i) => i.savedForLater);
  let quote = null;
  let quoteError: string | null = null;
  if (active.length) {
    try { quote = await buildQuote({ lines: active.map((i) => ({ productId: i.productId, quantity: i.quantity })), mode: "OUTRIGHT" }); }
    catch (e) { quoteError = e instanceof OrderError ? e.message : "We could not price your cart."; }
  }
  const mixed = new Set(active.map((i) => i.product.type === "VEHICLE" ? "v" : "o")).size > 1;
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">Your cart</h1>
      {sp.error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">That item is not available.</p>}
      {active.length === 0 ? (
        <div className="card mt-6 p-10 text-center"><p className="font-display text-lg font-bold text-navy">Your cart is empty.</p><div className="mt-4 flex justify-center gap-3"><Link href="/cars" className="btn-primary">Browse cars</Link><Link href="/accessories" className="btn-ghost">Shop accessories</Link></div></div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {active.map((i) => {
              const price = Number(i.product.price) - Number(i.product.discount);
              const href = i.product.type === "VEHICLE" ? `/cars/${i.product.slug}` : `/shop/${i.product.slug}`;
              return (
                <li key={i.id} className="card flex gap-4 p-4">
                  <Link href={href} className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-brand-50">{i.product.images[0] && <SmartImage src={i.product.images[0].url} alt={i.product.name} className="h-full w-full object-cover" sizes="128px" />}</Link>
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="line-clamp-2 font-semibold text-navy">{i.product.name}</Link>
                    <p className="mt-1 text-sm text-muted">{formatNaira(price)}{i.product.type === "VEHICLE" ? " · one vehicle per order" : ""}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {i.product.type !== "VEHICLE" && (
                        <form action={updateCartItem} className="flex items-center gap-1"><input type="hidden" name="itemId" value={i.id} />
                          <button name="intent" value="dec" className="btn-ghost !min-h-9 !px-3" aria-label="Decrease quantity">−</button>
                          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">{i.quantity}</span>
                          <button name="intent" value="inc" className="btn-ghost !min-h-9 !px-3" aria-label="Increase quantity">+</button></form>
                      )}
                      <form action={updateCartItem} className="flex gap-2"><input type="hidden" name="itemId" value={i.id} />
                        <button name="intent" value="save" className="text-sm font-medium text-brand hover:underline">Save for later</button>
                        <button name="intent" value="remove" className="text-sm font-medium text-danger hover:underline">Remove</button></form>
                    </div>
                  </div>
                  <p className="hidden font-display font-bold text-navy sm:block">{formatNaira(price * i.quantity)}</p>
                </li>
              );
            })}
          </ul>
          <aside className="card h-fit p-5">
            <h2 className="font-display text-lg font-bold text-navy">Order summary</h2>
            {quoteError ? <p role="alert" className="mt-3 text-sm text-danger">{quoteError}</p> : quote && (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatNaira(quote.pricing.subtotal)}</dd></div>
                {quote.pricing.discountTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="text-ok">−{formatNaira(quote.pricing.discountTotal)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">VAT ({quote.pricing.vatRateBps / 100}%)</dt><dd>{formatNaira(quote.pricing.vatTotal)}</dd></div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-navy"><dt>Total</dt><dd>{formatNaira(quote.pricing.grandTotal)}</dd></div>
              </dl>
            )}
            {mixed && <p className="mt-3 rounded-lg bg-brand-50 p-2.5 text-xs text-ink">Vehicles and accessories use different purchase flows. We will place them as separate orders; please check out the vehicle first.</p>}
            <p className="mt-3 text-xs text-muted">Delivery fees and installment options are shown at checkout. Final amounts are always calculated by our server.</p>
            <Link href="/checkout" className="btn-primary mt-4 w-full">Proceed to checkout</Link>
          </aside>
        </div>
      )}
      {saved.length > 0 && (
        <section className="mt-10"><h2 className="section-title">Saved for later</h2>
          <ul className="mt-4 space-y-2">{saved.map((i) => <li key={i.id} className="card flex items-center justify-between p-3 text-sm"><span className="font-medium text-navy">{i.product.name}</span>
            <form action={updateCartItem} className="flex gap-3"><input type="hidden" name="itemId" value={i.id} /><button name="intent" value="restore" className="font-medium text-brand hover:underline">Move to cart</button><button name="intent" value="remove" className="font-medium text-danger hover:underline">Remove</button></form></li>)}</ul></section>
      )}
    </div>
  );
}
