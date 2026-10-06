import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { saveSlide, moveSlide, deleteSlide } from "@/app/actions/admin-site";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";

export const metadata: Metadata = { title: "Carousel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CarouselAdmin({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage("content:view");
  const sp = await searchParams;
  const canEdit = user.permissions.has("content:edit");
  const slides = await db.slide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const form = (s: (typeof slides)[number] | null) => (
    <form action={saveSlide} className="mt-3 grid gap-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <ImageField name="imageUrl" label="Picture (wide, landscape works best)" defaultValue={s?.imageUrl} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`t-${s?.id}`}>Headline</label><input id={`t-${s?.id}`} name="title" defaultValue={s?.title} required maxLength={120} className="input" /></div>
        <div><label className="label" htmlFor={`b-${s?.id}`}>Small tag (for example Cars, Accessories, New)</label><input id={`b-${s?.id}`} name="badge" defaultValue={s?.badge ?? ""} maxLength={40} className="input" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`s-${s?.id}`}>Sub-headline</label><input id={`s-${s?.id}`} name="subtitle" defaultValue={s?.subtitle ?? ""} maxLength={240} className="input" /></div>
        <div><label className="label" htmlFor={`cl-${s?.id}`}>Button text</label><input id={`cl-${s?.id}`} name="ctaLabel" defaultValue={s?.ctaLabel ?? ""} maxLength={40} className="input" placeholder="View cars" /></div>
        <div><label className="label" htmlFor={`ch-${s?.id}`}>Button link (page path like /cars, or https://…)</label><input id={`ch-${s?.id}`} name="ctaHref" defaultValue={s?.ctaHref ?? ""} maxLength={300} className="input" placeholder="/cars" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`a-${s?.id}`}>Picture description (for screen readers)</label><input id={`a-${s?.id}`} name="imageAlt" defaultValue={s?.imageAlt ?? ""} maxLength={200} className="input" /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="h-4 w-4" /> Show this slide</label>
      <div><button className="btn-primary">{s ? "Save slide" : "Add slide"}</button></div>
    </form>
  );
  return (
    <>
      <PageHeader title="Carousel" sub="The big rotating banner under the header on public pages. Add cars, accessories, offers or announcements." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      {slides.length === 0 && <Notice>No slides yet, so the site automatically shows featured cars and accessories. Add your own slide to take control. Turn the carousel on or off, and change its speed, in Settings &gt; Homepage text.</Notice>}
      {!canEdit && <Notice>You can view slides but not change them.</Notice>}
      <div className="space-y-3">
        {slides.map((s, i) => (
          <details key={s.id} className="card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-navy">
              <span>{i + 1}. {s.title}</span> <Pill tone={s.active ? "ok" : "warn"}>{s.active ? "Showing" : "Hidden"}</Pill>
            </summary>
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                {i > 0 && <form action={moveSlide}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="up" /><button className="btn-ghost !min-h-8 !px-3 text-xs">Move earlier</button></form>}
                {i < slides.length - 1 && <form action={moveSlide}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="dir" value="down" /><button className="btn-ghost !min-h-8 !px-3 text-xs">Move later</button></form>}
                <form action={deleteSlide}><input type="hidden" name="id" value={s.id} /><button className="rounded-xl px-3 text-xs font-semibold text-danger hover:bg-danger/10">Delete</button></form>
              </div>
            )}
            {canEdit && form(s)}
          </details>
        ))}
        {canEdit && <details className="card p-4" open={slides.length === 0}><summary className="cursor-pointer font-semibold text-brand">+ Add a slide</summary>{form(null)}</details>}
      </div>
    </>
  );
}
