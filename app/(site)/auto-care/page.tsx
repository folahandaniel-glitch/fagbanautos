import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";

export const metadata: Metadata = { title: "Auto Care services", description: "Book inspection, maintenance, diagnostics, detailing and repair with FAGDAN Auto Care.", alternates: { canonical: "/auto-care" } };
export const dynamic = "force-dynamic";

export default async function AutoCare() {
  const c = await getContent();
  const services = await db.service.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">{c.t("pages.autocare.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{c.t("pages.autocare.intro")}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <li key={s.id}><Link href={`/auto-care/${s.slug}`} className="card tilt flex h-full flex-col justify-between p-5">
            <div><p className="font-display text-lg font-bold text-navy">{s.name}</p><p className="mt-1 line-clamp-3 text-sm text-muted">{s.description}</p></div>
            <p className="mt-4 flex items-center justify-between text-sm"><span className="font-bold text-navy">{s.priceNote ?? "From"} {formatNaira(Number(s.price))}</span><span className="text-muted">{s.durationMin} min</span></p>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}
