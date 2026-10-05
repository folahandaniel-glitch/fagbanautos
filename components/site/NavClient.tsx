"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface DivisionLink { name: string; href: string; tagline?: string | null }

export function DivisionSwitcher({ groupName, divisions }: { groupName: string; divisions: DivisionLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className="btn-ghost !min-h-10 !px-3 text-xs sm:text-sm">
        Divisions
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-line bg-white p-2 shadow-2xl lg:left-0 lg:right-auto">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted">{groupName}</p>
          <ul>
            {divisions.map((d) => (
              <li key={d.href}>
                <Link href={d.href} onClick={() => setOpen(false)} className="flex flex-col rounded-xl px-3 py-2.5 hover:bg-brand-50">
                  <span className="text-sm font-semibold text-navy">{d.name}</span>
                  {d.tagline && <span className="text-xs text-muted">{d.tagline}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form role="search" className={className} onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <label htmlFor="global-search" className="sr-only">Search cars, parts, accessories and services</label>
      <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search cars, parts, e.g. brake pad 2021 Toyota Camry" />
    </form>
  );
}

export function MobileBottomNav({ cartCount }: { cartCount: number }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Home", icon: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
    { href: "/cars", label: "Cars", icon: "M5 16l1.5-5a2 2 0 0 1 1.9-1.4h7.2a2 2 0 0 1 1.9 1.4L19 16M5 16v3h2v-2h10v2h2v-3M5 16h14M8 13h.01M16 13h.01" },
    { href: "/accessories", label: "Shop", icon: "M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
    { href: "/auto-care", label: "Services", icon: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" },
    { href: "/account", label: "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
  ];
  return (
    <nav aria-label="Primary mobile" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-brand" : "text-muted"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={it.icon} /></svg>
                {it.label}
                {it.label === "Shop" && cartCount > 0 && <span className="absolute right-5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-navy">{cartCount}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
