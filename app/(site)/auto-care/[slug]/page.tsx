import { jsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth/session";
import { availability } from "@/lib/services/bookings";
import { formatNaira } from "@/lib/money";
import { tomorrowIso } from "@/lib/dates";
import { bookService } from "@/app/actions/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await db.service.findUnique({ where: { slug: (await params).slug } });
  return s ? { title: s.name, description: s.description ?? undefined, alternates: { canonical: `/auto-care/${s.slug}` } } : {};
}

export default async function ServicePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ date?: string; location?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const service = await db.service.findUnique({ where: { slug } });
  if (!service || !service.isActive) notFound();
  const [s, user] = await Promise.all([getSettings(), getSessionUser()]);
  const locations = String(s["autocare.locations"]).split(",").map((x) => x.trim()).filter(Boolean);
  const location = locations.includes(sp.location ?? "") ? sp.location! : locations[0];
  const tomorrow = tomorrowIso();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date >= tomorrow.slice(0, 10) ? sp.date : tomorrow;
  const slots = await availability(service.id, location, date);
  const ld = { "@context": "https://schema.org", "@type": "Service", name: service.name, description: service.description, provider: { "@type": "AutoRepair", name: "FAGDAN Auto Care" }, offers: { "@type": "Offer", price: Number(service.price) / 100, priceCurrency: "NGN" } };
  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/auto-care" className="hover:text-brand">Auto Care</Link> / <span className="text-ink">{service.name}</span></nav>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div><h1 className="font-display text-3xl font-extrabold text-navy">{service.name}</h1>
          <p className="mt-3 text-muted">{service.description}</p>
          <p className="mt-4 text-lg font-bold text-navy">{service.priceNote ?? "From"} {formatNaira(Number(service.price))} <span className="text-sm font-normal text-muted">· about {service.durationMin} minutes · VAT added at payment</span></p>
          <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm">Final price depends on your vehicle and parts needed. We confirm any extra cost with you before starting work.</p></div>
        <div className="card p-5">
          <h2 className="font-display text-lg font-bold text-navy">Book this service</h2>
          {sp.error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{sp.error}</p>}
          <form method="get" className="mt-3 grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="b-date">Date</label><input id="b-date" type="date" name="date" min={tomorrow} defaultValue={date} className="input" /></div>
            <div><label className="label" htmlFor="b-loc">Location</label><select id="b-loc" name="location" defaultValue={location} className="input">{locations.map((l) => <option key={l}>{l}</option>)}</select></div>
            <button className="btn-ghost col-span-2">Check availability</button>
          </form>
          <form action={bookService} encType="multipart/form-data" className="mt-4 space-y-3 border-t border-line pt-4">
            <input type="hidden" name="serviceId" value={service.id} /><input type="hidden" name="slug" value={service.slug} /><input type="hidden" name="date" value={date} /><input type="hidden" name="location" value={location} />
            <fieldset><legend className="label">Available times on {new Date(date + "T12:00:00").toLocaleDateString("en-NG", { dateStyle: "full" })}</legend>
              <div className="grid grid-cols-3 gap-2">{slots.map((sl) => <label key={sl.hour} className={`relative flex min-h-11 items-center justify-center rounded-xl border text-sm font-semibold ${sl.free ? "cursor-pointer border-line hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white" : "cursor-not-allowed border-line bg-canvas text-muted/60 line-through"}`}>
                <input type="radio" name="hour" value={sl.hour} disabled={!sl.free} required className="sr-only" />{String(sl.hour).padStart(2, "0")}:00</label>)}</div>
            </fieldset>
            <div><label className="label" htmlFor="b-veh">Your vehicle (make, model, year)</label><input id="b-veh" name="vehicleInfo" required className="input" placeholder="2019 Toyota Camry" /></div>
            <div><label className="label" htmlFor="b-notes">Notes</label><textarea id="b-notes" name="notes" className="input min-h-20" placeholder="Describe any issues" /></div>
            <div><label className="label" htmlFor="b-photos">Photos (optional, up to 4)</label><input id="b-photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="input !py-2" /></div>
            <button className="btn-primary w-full">{user ? "Confirm booking" : "Sign in to book"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
