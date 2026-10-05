import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await db.cmsPage.findUnique({ where: { slug: (await params).slug } });
  return p ? { title: p.seoTitle ?? p.title, description: p.seoDescription ?? undefined } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await db.cmsPage.findUnique({ where: { slug: (await params).slug } });
  if (!p || !p.published) notFound();
  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="font-display text-3xl font-extrabold text-navy">{p.title}</h1>
      <p className="mt-1 text-xs text-muted">Last updated {p.updatedAt.toLocaleDateString("en-NG", { dateStyle: "long" })}</p>
      {p.body.includes("[") && /\[[A-Z]/.test(p.body) && <p role="note" className="mt-4 rounded-xl bg-accent/15 p-3 text-sm text-ink"><strong>Draft.</strong> This page is awaiting legal review. Items in [SQUARE BRACKETS] will be completed before it takes effect.</p>}
      <div className="mt-6 whitespace-pre-line leading-relaxed text-ink">{p.body}</div>
    </div>
  );
}
