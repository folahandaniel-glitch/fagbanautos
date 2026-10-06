import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return db.teamMember.findFirst({ where: { id, active: true } }).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await load((await params).id);
  return m ? { title: `${m.name}, ${m.role}`, description: m.bio?.slice(0, 160), alternates: { canonical: `/about/team/${m.id}` } } : { title: "Team profile" };
}

export default async function TeamProfile({ params }: { params: Promise<{ id: string }> }) {
  const m = await load((await params).id);
  if (!m) notFound();
  const paragraphs = (m.bio ?? "").split(/\n\s*\n|\n/).filter(Boolean);
  const initials = m.name.replace(/^(mr|mrs|ms|dr|chief|engr)\.?\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <div className="container-x py-10 sm:py-14">
      <Link href="/about" className="text-sm font-semibold text-brand hover:underline">← About FAGDAN</Link>
      <div className="mt-6 grid items-start gap-8 md:grid-cols-[320px_1fr]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100">
          {m.photoUrl ? (
            <Image src={m.photoUrl} alt={`${m.name}, ${m.role}`} fill sizes="(max-width: 768px) 100vw, 320px" className="object-cover object-top" priority />
          ) : (
            <div className="flex h-full w-full items-center justify-center" role="img" aria-label={`Photo of ${m.name} coming soon`}>
              <span className="flex h-28 w-28 items-center justify-center rounded-full bg-white/70 font-display text-4xl font-extrabold text-brand/70">{initials}</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">{m.role}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy sm:text-4xl">{m.name}</h1>
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted">{paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p>FAGDAN Automotive Group.</p>}</div>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/contact" className="btn-primary">Contact FAGDAN</Link><Link href="/cars" className="btn-ghost">Browse cars</Link></div>
        </div>
      </div>
    </div>
  );
}
