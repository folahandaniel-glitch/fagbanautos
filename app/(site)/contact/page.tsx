import { jsonLd } from "@/lib/json-ld";
import { getContent } from "@/lib/content";
import type { Metadata } from "next";
import { getSite, displayPhone, waLink } from "@/lib/site";
import { submitContact } from "@/app/actions/enquiry";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [site, sp, c] = await Promise.all([getSite(), searchParams, getContent()]);
  const ld = { "@context": "https://schema.org", "@type": "AutoDealer", name: site.flagship, telephone: site.phone1, email: site.email, address: { "@type": "PostalAddress", streetAddress: site.address, addressCountry: "NG" }, openingHours: site.hours };
  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <h1 className="font-display text-3xl font-extrabold text-navy">Contact FAGDAN</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{c.t("pages.contact.intro")}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card space-y-3 p-6 text-sm">
          <p><strong className="text-navy">Phone / WhatsApp</strong><br /><a className="text-brand" href={`tel:${site.phone1}`}>{displayPhone(site.phone1)}</a> · <a className="text-brand" href={`tel:${site.phone2}`}>{displayPhone(site.phone2)}</a></p>
          <p><strong className="text-navy">Email</strong><br /><a className="text-brand" href={`mailto:${site.email}`}>{site.email}</a></p>
          <p><strong className="text-navy">Address</strong><br />{site.address}</p>
          <p><strong className="text-navy">Hours</strong><br />{site.hours}</p>
          <a href={waLink(site.phone1, "Hello FAGDAN")} target="_blank" rel="noopener noreferrer" className="btn-gold">Chat on WhatsApp</a>
        </div>
        <form action={submitContact} className="card space-y-4 p-6">
          {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{sp.error === "rate" ? "Too many messages. Please wait a few minutes." : "Please check your details and tick the consent box."}</p>}
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" autoComplete="name" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" required className="input" autoComplete="tel" /></div><div><label className="label" htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" className="input" autoComplete="email" /></div></div>
          <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" required className="input min-h-28" /></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1 h-4 w-4" /> I agree that FAGDAN may contact me about this enquiry.</label>
          <button className="btn-primary">Send message</button>
        </form>
      </div>
    </div>
  );
}
