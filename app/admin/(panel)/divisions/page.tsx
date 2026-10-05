import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { saveDivision } from "@/app/actions/admin-content";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Divisions", robots: { index: false } };
export const dynamic = "force-dynamic";

function Form({ d }: { d?: { id: string; name: string; slug: string; tagline: string | null; description: string | null; icon: string | null; accent: string | null; sortOrder: number; isVisible: boolean } }) {
  const k = d?.id ?? "new";
  return (
    <form action={saveDivision} className="grid gap-3 sm:grid-cols-3">
      {d && <input type="hidden" name="id" value={d.id} />}
      <div><label className="label" htmlFor={`n-${k}`}>Name</label><input id={`n-${k}`} name="name" defaultValue={d?.name} required className="input" /></div>
      <div><label className="label" htmlFor={`t-${k}`}>Tagline</label><input id={`t-${k}`} name="tagline" defaultValue={d?.tagline ?? ""} className="input" /></div>
      <div><label className="label" htmlFor={`o-${k}`}>Order</label><input id={`o-${k}`} name="sortOrder" type="number" defaultValue={d?.sortOrder ?? 99} className="input" /></div>
      {!d && <div><label className="label" htmlFor="slug-new">URL slug (optional)</label><input id="slug-new" name="slug" className="input" placeholder="auto-insurance" /></div>}
      <div><label className="label" htmlFor={`a-${k}`}>Accent colour</label><input id={`a-${k}`} name="accent" type="color" defaultValue={d?.accent ?? "#0B3A8F"} className="h-11 w-24 rounded-lg border border-line" /></div>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium"><input type="checkbox" name="isVisible" defaultChecked={d?.isVisible ?? true} className="h-4 w-4" /> Visible on the site</label>
      <div className="sm:col-span-3"><label className="label" htmlFor={`d-${k}`}>Description</label><textarea id={`d-${k}`} name="description" defaultValue={d?.description ?? ""} className="input min-h-16" /></div>
      <div><button className="btn-primary">{d ? "Save" : "Create division"}</button></div>
    </form>
  );
}

export default async function DivisionsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage();
  if (!["divisions:view", "settings:manage"].some((p) => user.permissions.has(p))) await requireStaffPage("divisions:view");
  const sp = await searchParams;
  const divisions = await db.division.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true, categories: true } } } });
  return (
    <>
      <PageHeader title="Divisions" sub="Divisions are data: rename, reorder, hide, or create new ones with no code change. New divisions appear in the switcher and footer automatically." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="space-y-4">
        {divisions.map((d) => <section key={d.id} className="card p-5"><div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-bold text-navy">{d.name}</h2><Pill tone={d.isVisible ? "ok" : "warn"}>{d.isVisible ? "Visible" : "Hidden"}</Pill><span className="text-xs text-muted">/{d.slug} · {d._count.products} products · {d._count.categories} categories</span></div><Form d={d} /></section>)}
        <section className="card p-5"><h2 className="mb-3 font-display text-lg font-bold text-navy">Create a new division</h2><Form /></section>
      </div>
    </>
  );
}
