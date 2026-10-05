import type { Metadata } from "next";
import { applyFinance } from "@/app/actions/services";

export const metadata: Metadata = { title: "Finance application", robots: { index: false } };
const ERR: Record<string, string> = { invalid: "Please check the amounts: the deposit must be less than the vehicle price.", rate: "Too many requests. Please wait a few minutes." };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-2xl py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">Finance application</h1>
      <p className="mt-1 text-sm text-muted">Tell us about the vehicle and the plan you want. Our team reviews every application and contacts you.</p>
      <form action={applyFinance} encType="multipart/form-data" className="card mt-6 space-y-4 p-6">
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{ERR[sp.error] ?? sp.error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="vp">Vehicle price (₦)</label><input id="vp" name="vehiclePriceNaira" inputMode="numeric" required className="input" /></div>
          <div><label className="label" htmlFor="dp">Deposit (₦)</label><input id="dp" name="depositNaira" inputMode="numeric" required className="input" /></div>
          <div><label className="label" htmlFor="tm">Term (months)</label><select id="tm" name="termMonths" className="input" defaultValue="12">{[3, 6, 9, 12, 18, 24].map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="label" htmlFor="docs">Documents (ID, proof of income)</label><input id="docs" name="documents" type="file" multiple accept="image/jpeg,image/png,image/webp" className="input !py-2" /></div>
        </div>
        <div><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="input min-h-24" /></div>
        <button className="btn-primary">Submit application</button>
      </form>
    </div>
  );
}
