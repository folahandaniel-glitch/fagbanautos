import type { Metadata } from "next";
import { requestImport } from "@/app/actions/services";

export const metadata: Metadata = { title: "Import request", robots: { index: false } };
const COUNTRIES = ["Japan", "USA", "Canada", "Germany", "Korea", "China", "United Kingdom", "Europe", "Other"];

export default async function ImportRequest({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">I want FAGDAN to source/import this vehicle</h1>
      <form action={requestImport} className="card mt-6 space-y-4 p-6">
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">Please check your details and try again.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="make">Make</label><input id="make" name="make" required className="input" /></div>
          <div><label className="label" htmlFor="model">Model</label><input id="model" name="model" required className="input" /></div>
          <div><label className="label" htmlFor="year">Year</label><input id="year" name="year" inputMode="numeric" className="input" /></div>
          <div><label className="label" htmlFor="trim">Trim</label><input id="trim" name="trim" className="input" /></div>
          <div><label className="label" htmlFor="country">Source country</label><select id="country" name="country" className="input">{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="budgetNaira">Budget (₦)</label><input id="budgetNaira" name="budgetNaira" inputMode="numeric" className="input" /></div>
          <div><label className="label" htmlFor="condition">Condition</label><select id="condition" name="condition" className="input"><option>Foreign Used</option><option>Brand New</option><option>Nearly New</option></select></div>
          <div><label className="label" htmlFor="colour">Colour</label><input id="colour" name="colour" className="input" /></div>
          <div><label className="label" htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="input" /></div>
        </div>
        <div><label className="label" htmlFor="specs">Preferred specifications</label><textarea id="specs" name="specs" className="input min-h-20" placeholder="Engine, options, mileage limit…" /></div>
        <div><label className="label" htmlFor="notes">Additional requirements</label><textarea id="notes" name="notes" className="input min-h-20" /></div>
        <button className="btn-primary">Submit request</button>
        <p className="text-xs text-muted">You must be signed in. We will create a sourcing case and contact you.</p>
      </form>
    </div>
  );
}
