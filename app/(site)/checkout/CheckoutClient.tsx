"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { quoteAction, placeOrder, type CheckoutInput, type QuoteResult, type QuoteView } from "@/app/actions/checkout";
import { formatNaira } from "@/lib/money";

const STEPS = ["Your details", "Delivery", "Order summary", "VAT", "Payment"] as const;
const NG_STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];

interface Props {
  user: { name: string; email: string; phone: string };
  defaultMode: "OUTRIGHT" | "INSTALLMENT";
  initial: QuoteResult;
  paystackEnabled: boolean;
  bankEnabled: boolean;
  vatPolicy: { requireReason: boolean; requireApproval: boolean };
}

export function CheckoutClient({ user, defaultMode, initial, paystackEnabled, bankEnabled, vatPolicy }: Props) {
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState<QuoteResult>(initial);
  const [mode, setMode] = useState<"OUTRIGHT" | "INSTALLMENT">(defaultMode);
  const [deposit, setDeposit] = useState<number | "">("");
  const [delivery, setDelivery] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [addr, setAddr] = useState({ address: "", city: "", state: "Lagos", contact: user.phone });
  const [coupon, setCoupon] = useState("");
  const [vatOff, setVatOff] = useState(false);
  const [vatReason, setVatReason] = useState("");
  const [method, setMethod] = useState<"PAYSTACK" | "BANK_TRANSFER" | "">(paystackEnabled ? "PAYSTACK" : bankEnabled ? "BANK_TRANSFER" : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [idemKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)));
  const reqId = useRef(0);

  const q = quote.ok ? quote : null;
  const minDepNaira = q ? Math.ceil(q.minDeposit / 100) : 0;
  const effDeposit = deposit === "" ? minDepNaira : deposit;
  const input = (): CheckoutInput => ({
    mode, depositNaira: mode === "INSTALLMENT" ? Number(effDeposit || 0) : undefined, deliveryMethod: delivery,
    delivery: delivery === "DELIVERY" ? addr : undefined, couponCode: coupon || undefined, vatOff, vatReason: vatOff ? vatReason : undefined,
  });

  // Re-quote on the server whenever a pricing input changes. The browser never computes totals.
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(() => {
      quoteAction({ mode, depositNaira: mode === "INSTALLMENT" ? Number(effDeposit || 0) : undefined, deliveryMethod: delivery, couponCode: coupon || undefined, vatOff, vatReason: vatOff ? vatReason : undefined }).then((r) => { if (id === reqId.current) setQuote(r); });
    }, 350);
    return () => clearTimeout(t);
  }, [mode, effDeposit, delivery, coupon, vatOff, vatReason]);

  const next = () => {
    setError(null);
    if (step === 1 && delivery === "DELIVERY" && !(addr.address.trim() && addr.city.trim())) return setError("Please enter your delivery address and city.");
    if (step === 3 && vatOff && vatPolicy.requireReason && vatReason.trim().length < 5) return setError("Please state the reason for the VAT exemption.");
    if (step === 2 && !quote.ok) return setError(quote.error);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = () => {
    setError(null);
    if (!method) return setError("Please choose a payment method.");
    start(async () => {
      const r = await placeOrder({ ...input(), paymentMethod: method, idemKey });
      if (r.ok) window.location.href = r.redirect;
      else setError(r.error);
    });
  };

  return (
    <div className="container-x py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">Checkout</h1>
      <ol className="mt-5 flex flex-wrap gap-2" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === step ? "bg-brand text-white" : i < step ? "bg-brand-50 text-brand" : "bg-white text-muted ring-1 ring-line"}`}>{i + 1}. {s}</li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-5 sm:p-6" aria-live="polite">
          {error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          {!quote.ok && step > 1 && <p role="alert" className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{quote.error}</p>}

          {step === 0 && (
            <div className="space-y-4"><h2 className="font-display text-xl font-bold text-navy">Your details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="c-name">Full name</label><input id="c-name" className="input" value={user.name} readOnly /></div>
                <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" className="input" value={user.email} readOnly /></div>
                <div><label className="label" htmlFor="c-phone">Phone</label><input id="c-phone" className="input" value={user.phone} readOnly /></div>
              </div>
              <p className="text-sm text-muted">These come from your account. Receipts and updates are sent to this email and phone.</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4"><h2 className="font-display text-xl font-bold text-navy">Delivery or collection</h2>
              <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="sr-only">Method</legend>
                {([["PICKUP", "Collect from FAGDAN", "Free. Collect at our showroom once ready."], ["DELIVERY", "Delivery", "We deliver to your address. Fees apply to parts and accessories."]] as const).map(([v, t, d]) => (
                  <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${delivery === v ? "border-brand bg-brand-50" : "border-line"}`}>
                    <input type="radio" name="delivery" checked={delivery === v} onChange={() => setDelivery(v)} className="mt-1" /><span><span className="block font-semibold text-navy">{t}</span><span className="text-sm text-muted">{d}</span></span>
                  </label>
                ))}
              </fieldset>
              {delivery === "DELIVERY" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="label" htmlFor="d-addr">Street address</label><input id="d-addr" className="input" value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} autoComplete="street-address" /></div>
                  <div><label className="label" htmlFor="d-city">City</label><input id="d-city" className="input" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} autoComplete="address-level2" /></div>
                  <div><label className="label" htmlFor="d-state">State</label><select id="d-state" className="input" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })}>{NG_STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="label" htmlFor="d-contact">Contact phone</label><input id="d-contact" className="input" value={addr.contact} onChange={(e) => setAddr({ ...addr, contact: e.target.value })} autoComplete="tel" /></div>
                </div>
              )}
            </div>
          )}

          {step === 2 && q && (
            <div className="space-y-5"><h2 className="font-display text-xl font-bold text-navy">Order summary</h2>
              <ul className="divide-y divide-line">{q.lines.map((l, i) => <li key={i} className="flex justify-between gap-4 py-3 text-sm"><span><span className="font-semibold text-navy">{l.name}</span><span className="block text-muted">Qty {l.quantity} · {formatNaira(l.unitPrice)}</span></span><span className="font-semibold">{formatNaira(l.lineTotal)}</span></li>)}</ul>
              {q.installmentEligible && (
                <fieldset className="rounded-xl border border-accent/50 bg-accent/5 p-4"><legend className="px-1 text-sm font-bold text-navy">How would you like to pay?</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {([["OUTRIGHT", "Outright purchase", "Pay the full price now."], ["INSTALLMENT", "FAGDAN installment", "Outright price + 10%. Vehicle released after 90% is paid and verified."]] as const).map(([v, t, d]) => (
                      <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-3 ${mode === v ? "border-brand ring-2 ring-brand/20" : "border-line"}`}><input type="radio" name="mode" checked={mode === v} onChange={() => { setMode(v); setDeposit(""); }} className="mt-1" /><span><span className="block text-sm font-semibold text-navy">{t}</span><span className="text-xs text-muted">{d}</span></span></label>
                    ))}
                  </div>
                  {mode === "INSTALLMENT" && (
                    <div className="mt-4"><label className="label" htmlFor="deposit">Deposit today (₦)</label>
                      <input id="deposit" inputMode="numeric" className="input max-w-xs" value={effDeposit} onChange={(e) => setDeposit(e.target.value === "" ? "" : Math.max(0, Number(e.target.value.replace(/\D/g, ""))))} aria-describedby="dep-help" />
                      <p id="dep-help" className="mt-1 text-xs text-muted">Minimum deposit {formatNaira(q.minDeposit)}. You will pay the balance in agreed installments; the vehicle is released once at least {formatNaira(q.releaseThreshold)} has been verified.</p></div>
                  )}
                </fieldset>
              )}
              <div className="max-w-sm"><label className="label" htmlFor="coupon">Coupon code</label><input id="coupon" className="input" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Optional" /></div>
            </div>
          )}

          {step === 3 && q && (
            <div className="space-y-4"><h2 className="font-display text-xl font-bold text-navy">VAT</h2>
              <p className="text-sm text-muted">VAT of <strong>{q.vatRateBps / 100}%</strong> applies to your order: <strong>{formatNaira(q.vatEnabled ? q.vatTotal : q.vatRemovedTotal)}</strong>. It is calculated by our server and shown on your invoice.</p>
              {q.vatOffAllowed ? (
                <div className="rounded-xl border border-line p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-navy"><input type="checkbox" checked={vatOff} onChange={(e) => setVatOff(e.target.checked)} className="h-4 w-4" /> My purchase is VAT-exempt</label>
                  {vatOff && (<div className="mt-3"><label className="label" htmlFor="vat-reason">Reason for exemption{vatPolicy.requireReason ? " (required)" : ""}</label><textarea id="vat-reason" className="input min-h-24" value={vatReason} onChange={(e) => setVatReason(e.target.value)} />
                    {vatPolicy.requireApproval && <p className="mt-2 text-xs text-warn">Your exemption must be approved by our finance team before you can pay.</p>}</div>)}
                </div>
              ) : <p className="rounded-xl bg-brand-50 p-3 text-sm">VAT is a statutory tax and cannot be switched off for this order.</p>}
            </div>
          )}

          {step === 4 && q && (
            <div className="space-y-4"><h2 className="font-display text-xl font-bold text-navy">Payment method</h2>
              {!paystackEnabled && !bankEnabled && <p role="alert" className="rounded-lg bg-warn/10 p-3 text-sm text-warn">No payment method is available yet. Please contact us on WhatsApp.</p>}
              <fieldset className="grid gap-3"><legend className="sr-only">Payment method</legend>
                {paystackEnabled && <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${method === "PAYSTACK" ? "border-brand bg-brand-50" : "border-line"}`}><input type="radio" name="pm" checked={method === "PAYSTACK"} onChange={() => setMethod("PAYSTACK")} className="mt-1" /><span><span className="block font-semibold text-navy">Pay online with Paystack</span><span className="text-sm text-muted">Card, bank transfer or USSD. Verified automatically.</span></span></label>}
                {bankEnabled && <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${method === "BANK_TRANSFER" ? "border-brand bg-brand-50" : "border-line"}`}><input type="radio" name="pm" checked={method === "BANK_TRANSFER"} onChange={() => setMethod("BANK_TRANSFER")} className="mt-1" /><span><span className="block font-semibold text-navy">Bank transfer</span><span className="text-sm text-muted">Transfer to our account, then upload your proof. Confirmed after our finance team verifies it.</span></span></label>}
              </fieldset>
              <p className="text-sm text-muted">You will pay <strong>{formatNaira(q.amountDueNow)}</strong> now{q.balanceAfterDueNow > 0 ? <> and {formatNaira(q.balanceAfterDueNow)} later</> : null}.</p>
              <button onClick={submit} disabled={pending || !method || !quote.ok} className="btn-primary w-full sm:w-auto">{pending ? "Placing your order…" : "Place order and pay"}</button>
            </div>
          )}

          <div className="mt-6 flex justify-between border-t border-line pt-4">
            <button onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0} className="btn-ghost">Back</button>
            {step < STEPS.length - 1 && <button onClick={next} className="btn-primary">Continue</button>}
          </div>
        </section>

        <SummaryCard q={q} />
      </div>
    </div>
  );
}

function SummaryCard({ q }: { q: QuoteView | null }) {
  if (!q) return <aside className="card h-fit p-5 text-sm text-muted">Calculating…</aside>;
  const row = (label: string, v: string, cls = "") => <div className={`flex justify-between ${cls}`}><dt className="text-muted">{label}</dt><dd>{v}</dd></div>;
  return (
    <aside className="card h-fit space-y-2 p-5 text-sm lg:sticky lg:top-28" aria-label="Order total">
      <h2 className="font-display text-lg font-bold text-navy">Order total</h2>
      <dl className="space-y-2">
        {row("Subtotal", formatNaira(q.subtotal))}
        {q.discountTotal > 0 && row("Discount", `−${formatNaira(q.discountTotal)}`, "text-ok")}
        {q.upliftTotal > 0 && row("Installment adjustment (10%)", formatNaira(q.upliftTotal))}
        {row(`VAT (${q.vatRateBps / 100}%)`, q.vatEnabled ? formatNaira(q.vatTotal) : "₦0 (exempt)")}
        {q.charges.map((c) => <div key={c.label}>{row(c.label, formatNaira(c.amount))}</div>)}
        {q.tradeInCredit > 0 && row("Trade-in credit", `−${formatNaira(q.tradeInCredit)}`, "text-ok")}
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-navy"><dt>Grand total</dt><dd>{formatNaira(q.grandTotal)}</dd></div>
        {q.mode === "INSTALLMENT" && <>
          {row("Due today", formatNaira(q.amountDueNow), "font-semibold")}
          {row("Release threshold", formatNaira(q.releaseThreshold))}
        </>}
      </dl>
      <p className="pt-2 text-xs text-muted">Calculated by the FAGDAN server. Final amounts are confirmed before payment.</p>
    </aside>
  );
}
