"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface NavItem { href: string; label: string }

export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <nav aria-label="Admin">
      <button className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold lg:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Menu <span aria-hidden="true">{open ? "−" : "+"}</span></button>
      <ul className={`${open ? "block" : "hidden"} space-y-0.5 p-2 lg:block`}>
        {items.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return <li key={i.href}><Link href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>{i.label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
