import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "FAGDAN Imports", description: "We source, ship and clear vehicles from Japan, USA, Canada, Germany, Korea, China, the UK and Europe.", alternates: { canonical: "/imports" } };

const COUNTRIES = ["Japan", "USA", "Canada", "Germany", "Korea", "China", "United Kingdom", "Europe"];
const STAGES = ["Request received", "Vehicle sourcing", "Vehicle found", "Customer approval", "Purchase processing", "Shipping", "In transit", "Port arrival", "Customs processing", "Inspection", "Documentation", "Ready for delivery"];

export default function ImportsPage() {
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">FAGDAN Imports</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Tell us the car you want. We source it, ship it, clear it and keep you updated at every stage.</p>
      <div className="mt-5 flex flex-wrap gap-2">{COUNTRIES.map((c) => <span key={c} className="chip">{c}</span>)}</div>
      <Link href="/imports/request" className="btn-gold mt-6">I want FAGDAN to source/import this vehicle</Link>
      <section className="mt-10"><h2 className="section-title">How tracking works</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STAGES.map((s, i) => <li key={s} className="card flex items-center gap-3 p-4 text-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>{s}</li>)}</ol></section>
    </div>
  );
}
