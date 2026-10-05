import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "About FAGDAN", alternates: { canonical: "/about" } };
export const dynamic = "force-dynamic";

export default async function About() {
  const page = await db.cmsPage.findUnique({ where: { slug: "about" } });
  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="font-display text-3xl font-extrabold text-navy">{page?.title ?? "About FAGDAN"}</h1>
      <div className="mt-4 space-y-4 whitespace-pre-line leading-relaxed text-muted">{page?.body}</div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">{["Trust: transparent pricing and verified listings", "Choice: vehicles, parts, accessories, care, finance and imports", "Technology: secure online payments and live tracking", "Service: people who pick up the phone"].map((t) => <li key={t} className="card p-4 text-sm font-medium text-navy">{t}</li>)}</ul>
    </div>
  );
}
