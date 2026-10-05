import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { getSite, displayPhone, waLink } from "@/lib/site";
import { getDivisions, divisionHref } from "@/lib/divisions";
import { cartCount } from "@/lib/cart";
import { getSessionUser } from "@/lib/auth/session";
import { DivisionSwitcher, SearchBox } from "./NavClient";

export async function Header() {
  const [site, menu, divisions, count, user] = await Promise.all([
    getSite(),
    db.menuItem.findMany({ where: { menu: "primary", isVisible: true }, orderBy: { sortOrder: "asc" } }),
    getDivisions(),
    cartCount(),
    getSessionUser(),
  ]);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="hidden bg-navy text-xs text-white/85 md:block">
        <div className="container-x flex items-center justify-between py-1.5">
          <span>{site.tagline}</span>
          <span className="flex items-center gap-4">
            <a href={`tel:${site.phone1}`} className="hover:text-accent">{displayPhone(site.phone1)}</a>
            <a href={`tel:${site.phone2}`} className="hover:text-accent">{displayPhone(site.phone2)}</a>
            <a href={waLink(site.phone1)} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">WhatsApp us</a>
          </span>
        </div>
      </div>
      <div className="container-x flex items-center gap-3 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${site.name} home`}>
          <Image src={site.logo} alt={site.name} width={64} height={52} priority className="h-11 w-auto" />
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-sm font-extrabold tracking-tight text-navy">FAGDAN</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-600">Automotive Group</span>
          </span>
        </Link>
        <SearchBox className="mx-2 hidden max-w-md flex-1 lg:block" />
        <div className="ml-auto flex items-center gap-2">
          <DivisionSwitcher groupName={site.name} divisions={divisions.map((d) => ({ name: d.name, href: divisionHref(d.slug), tagline: d.tagline }))} />
          <Link href="/cart" className="btn-ghost relative !min-h-10 !px-3" aria-label={`Cart, ${count} items`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12zM6 6 5 3H2" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
            {count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-navy">{count}</span>}
          </Link>
          <Link href={user ? (user.kind === "STAFF" ? "/admin" : "/account") : "/account/login"} className="btn-primary hidden !min-h-10 sm:inline-flex">
            {user ? "My account" : "Sign in"}
          </Link>
        </div>
      </div>
      <nav aria-label="Primary" className="hidden border-t border-line md:block">
        <ul className="container-x flex flex-wrap items-center gap-x-1 py-1">
          {menu.map((m) => (
            <li key={m.id}><Link href={m.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:text-brand">{m.label}</Link></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export async function Footer() {
  const [site, divisions, pages] = await Promise.all([getSite(), getDivisions(), db.cmsPage.findMany({ where: { published: true }, select: { slug: true, title: true } })]);
  const legal = pages.filter((p) => ["terms", "privacy", "refunds", "installment-terms", "cookies"].includes(p.slug));
  return (
    <footer className="mt-16 bg-navy text-white/80">
      <div className="container-x grid gap-10 py-12 md:grid-cols-4">
        <div>
          <Image src={site.logo} alt={site.name} width={96} height={78} className="h-14 w-auto rounded-xl bg-white p-1.5" />
          <p className="mt-4 font-display text-lg font-bold text-white">{site.name}</p>
          <p className="mt-1 text-sm text-accent">{site.tagline}</p>
          {site.social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-3 text-sm">
              {site.social.map((s) => <li key={s.label}><a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{s.label}</a></li>)}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Divisions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {divisions.map((d) => <li key={d.id}><Link href={divisionHref(d.slug)} className="hover:text-accent">{d.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Company</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-accent">About</Link></li>
            <li><Link href="/contact" className="hover:text-accent">Contact</Link></li>
            <li><Link href="/faq" className="hover:text-accent">FAQ</Link></li>
            <li><Link href="/sell-or-swap" className="hover:text-accent">Sell or swap your car</Link></li>
            {legal.map((p) => <li key={p.slug}><Link href={`/legal/${p.slug}`} className="hover:text-accent">{p.title}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">Contact</h2>
          <address className="mt-3 space-y-2 text-sm not-italic">
            <p>{site.address}</p>
            <p><a href={`tel:${site.phone1}`} className="hover:text-accent">{displayPhone(site.phone1)}</a> · <a href={`tel:${site.phone2}`} className="hover:text-accent">{displayPhone(site.phone2)}</a></p>
            <p><a href={`mailto:${site.email}`} className="hover:text-accent">{site.email}</a></p>
            <p>{site.hours}</p>
            <p><a href={waLink(site.phone1, "Hello FAGDAN, I would like to make an enquiry.")} target="_blank" rel="noopener noreferrer" className="btn-gold !min-h-10 mt-2">WhatsApp enquiry</a></p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 pb-24 text-xs text-white/60 md:flex-row md:pb-5">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p className="flex items-center gap-3 text-center">
            <span>{site.creditText} ({site.creditPhone})</span>
            <Link href="/admin/login" rel="nofollow" className="rounded border border-white/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-white/40 hover:text-white/80">Backend</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

export async function WhatsAppFab() {
  const site = await getSite();
  return (
    <a href={waLink(site.phone1, "Hello FAGDAN, I would like to make an enquiry.")} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
      className="fixed bottom-20 right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg md:bottom-6">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.3-.3.6-.3.8-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z" /></svg>
    </a>
  );
}
