import type { Metadata } from "next";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Frequently asked questions", alternates: { canonical: "/faq" } };
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const faqs = await db.faq.findMany({ orderBy: { sortOrder: "asc" } });
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) };
  return (
    <div className="container-x max-w-3xl py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="font-display text-3xl font-extrabold text-navy">Frequently asked questions</h1>
      <div className="mt-6 space-y-3">{faqs.map((f) => <details key={f.id} className="card group p-4"><summary className="cursor-pointer font-semibold text-navy">{f.question}</summary><p className="mt-2 text-sm text-muted">{f.answer}</p></details>)}</div>
    </div>
  );
}
