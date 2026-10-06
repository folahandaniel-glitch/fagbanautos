import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { submitTradeOrSwap } from "@/app/actions/services";

export const metadata: Metadata = { title: "Sell, trade in or swap your car", description: "Get a valuation, trade in your car or swap for another vehicle with FAGDAN.", alternates: { canonical: "/sell-or-swap" } };

export default async function SellOrSwap({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const c = await getContent();
  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">{c.t("pages.sell.title")}</h1>
      <p className="mt-1 text-sm text-muted">{c.t("pages.sell.intro")}</p>
      <form action={submitTradeOrSwap} encType="multipart/form-data" className="card mt-6 space-y-4 p-6">
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{sp.error === "invalid" ? "Please check your details." : sp.error}</p>}
        <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="label">What would you like to do?</legend>
          <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-50"><input type="radio" name="kind" value="TRADE_IN" defaultChecked className="mt-1" /><span><strong className="block text-navy">Sell or trade in</strong><span className="text-sm text-muted">Get a valuation and credit.</span></span></label>
          <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-50"><input type="radio" name="kind" value="SWAP" className="mt-1" /><span><strong className="block text-navy">Swap</strong><span className="text-sm text-muted">Exchange for another car.</span></span></label>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="make">Make</label><input id="make" name="make" required className="input" /></div>
          <div><label className="label" htmlFor="model">Model</label><input id="model" name="model" required className="input" /></div>
          <div><label className="label" htmlFor="year">Year</label><input id="year" name="year" inputMode="numeric" required className="input" /></div>
          <div><label className="label" htmlFor="mileageKm">Mileage (km)</label><input id="mileageKm" name="mileageKm" inputMode="numeric" className="input" /></div>
          <div><label className="label" htmlFor="condition">Condition</label><select id="condition" name="condition" className="input"><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs repair</option></select></div>
          <div><label className="label" htmlFor="photos">Photos (up to 4)</label><input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="input !py-2" /></div>
        </div>
        <div><label className="label" htmlFor="description">Details</label><textarea id="description" name="description" className="input min-h-24" placeholder="Accident history, documents, the car you would like in exchange…" /></div>
        <button className="btn-primary">Submit</button>
        <p className="text-xs text-muted">You must be signed in. Valuations are indicative and subject to inspection.</p>
      </form>
    </div>
  );
}
