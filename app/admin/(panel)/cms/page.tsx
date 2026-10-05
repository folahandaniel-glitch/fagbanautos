import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { savePage, saveFaq, saveMenuItem, saveBanner, saveCoupon } from "@/app/actions/admin-content";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Content (CMS)", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CmsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage();
  if (!["content:view", "banners:view", "blog:view", "coupons:view", "campaigns:view"].some((p) => user.permissions.has(p))) await requireStaffPage("content:view");
  const sp = await searchParams;
  const [pages, faqs, menu, banners, coupons] = await Promise.all([db.cmsPage.findMany({ orderBy: { slug: "asc" } }), db.faq.findMany({ orderBy: { sortOrder: "asc" } }), db.menuItem.findMany({ where: { menu: "primary" }, orderBy: { sortOrder: "asc" } }), db.banner.findMany({ orderBy: { sortOrder: "asc" } }), db.coupon.findMany({ orderBy: { code: "asc" } })]);
  const canContent = user.permissions.has("content:edit");
  return (
    <>
      <PageHeader title="Content (CMS)" sub="Pages, navigation, FAQs, banners and coupons. Changes go live immediately." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      {canContent && (
        <section className="mb-8"><h2 className="mb-3 font-display text-xl font-bold text-navy">Pages</h2>
          <div className="space-y-3">{[...pages, null].map((p) => (
            <details key={p?.id ?? "new"} className="card p-4"><summary className="cursor-pointer font-semibold text-navy">{p ? `${p.title} (/legal/${p.slug})` : "+ New page"} {p && <Pill tone={p.published ? "ok" : "warn"}>{p.published ? "Published" : "Draft"}</Pill>}</summary>
              <form action={savePage} className="mt-3 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor={`ps-${p?.id}`}>Slug</label><input id={`ps-${p?.id}`} name="slug" defaultValue={p?.slug} required readOnly={!!p} className="input" /></div><div><label className="label" htmlFor={`pt-${p?.id}`}>Title</label><input id={`pt-${p?.id}`} name="title" defaultValue={p?.title} required className="input" /></div></div>
                <div><label className="label" htmlFor={`pb-${p?.id}`}>Body</label><textarea id={`pb-${p?.id}`} name="body" defaultValue={p?.body} className="input min-h-40" /></div>
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor={`pst-${p?.id}`}>SEO title</label><input id={`pst-${p?.id}`} name="seoTitle" defaultValue={p?.seoTitle ?? ""} className="input" /></div><div><label className="label" htmlFor={`psd-${p?.id}`}>SEO description</label><input id={`psd-${p?.id}`} name="seoDescription" defaultValue={p?.seoDescription ?? ""} className="input" /></div></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={p?.published ?? true} className="h-4 w-4" /> Published</label>
                <div><button className="btn-primary">Save page</button></div></form></details>))}</div></section>
      )}
      {canContent && (
        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <div><h2 className="mb-3 font-display text-xl font-bold text-navy">Main menu</h2><div className="space-y-2">{[...menu, null].map((m) => (
            <form key={m?.id ?? "new"} action={saveMenuItem} className="card flex flex-wrap items-end gap-2 p-3">{m && <input type="hidden" name="id" value={m.id} />}
              <div><label className="label" htmlFor={`ml-${m?.id}`}>Label</label><input id={`ml-${m?.id}`} name="label" defaultValue={m?.label} required className="input !min-h-9 !w-32" /></div>
              <div><label className="label" htmlFor={`mh-${m?.id}`}>Link</label><input id={`mh-${m?.id}`} name="href" defaultValue={m?.href} required className="input !min-h-9 !w-36" /></div>
              <div><label className="label" htmlFor={`mo-${m?.id}`}>Order</label><input id={`mo-${m?.id}`} name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 99} className="input !min-h-9 !w-16" /></div>
              <label className="flex min-h-9 items-center gap-1 text-xs"><input type="checkbox" name="isVisible" defaultChecked={m?.isVisible ?? true} /> Show</label>
              <button className="btn-primary !min-h-9 !px-3 text-xs">{m ? "Save" : "Add"}</button>{m && <button name="delete" value="1" className="text-xs font-medium text-danger">Delete</button>}</form>))}</div></div>
          <div><h2 className="mb-3 font-display text-xl font-bold text-navy">FAQs</h2><div className="space-y-2">{[...faqs, null].map((f) => (
            <form key={f?.id ?? "new"} action={saveFaq} className="card space-y-2 p-3">{f && <input type="hidden" name="id" value={f.id} />}
              <input name="question" defaultValue={f?.question} aria-label="Question" placeholder="Question" required className="input !min-h-9" /><textarea name="answer" defaultValue={f?.answer} aria-label="Answer" placeholder="Answer" required className="input min-h-16" />
              <div className="flex items-center gap-2"><input name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 99} aria-label="Order" className="input !min-h-9 !w-16" /><button className="btn-primary !min-h-9 !px-3 text-xs">{f ? "Save" : "Add FAQ"}</button>{f && <button name="delete" value="1" className="text-xs font-medium text-danger">Delete</button>}</div></form>))}</div></div>
        </section>
      )}
      {(user.permissions.has("banners:edit") || user.permissions.has("banners:create") || canContent) && (
        <section className="mb-8"><h2 className="mb-3 font-display text-xl font-bold text-navy">Banners</h2><div className="space-y-2">{[...banners, null].map((b) => (
          <form key={b?.id ?? "new"} action={saveBanner} className="card grid gap-2 p-3 sm:grid-cols-6">{b && <input type="hidden" name="id" value={b.id} />}
            <input name="title" defaultValue={b?.title} aria-label="Title" placeholder="Title" required className="input !min-h-9 sm:col-span-2" /><input name="subtitle" defaultValue={b?.subtitle ?? ""} aria-label="Subtitle" placeholder="Subtitle" className="input !min-h-9 sm:col-span-2" /><input name="ctaLabel" defaultValue={b?.ctaLabel ?? ""} aria-label="Button label" placeholder="Button label" className="input !min-h-9" /><input name="ctaHref" defaultValue={b?.ctaHref ?? ""} aria-label="Button link" placeholder="/cars" className="input !min-h-9" />
            <input name="imageUrl" defaultValue={b?.imageUrl ?? ""} aria-label="Image URL" placeholder="https://… image" className="input !min-h-9 sm:col-span-3" /><input name="placement" defaultValue={b?.placement ?? "home-hero"} aria-label="Placement" className="input !min-h-9" /><label className="flex min-h-9 items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={b?.isActive ?? true} /> Active</label>
            <div className="flex gap-2"><button className="btn-primary !min-h-9 !px-3 text-xs">{b ? "Save" : "Add banner"}</button>{b && <button name="delete" value="1" className="text-xs font-medium text-danger">Delete</button>}</div></form>))}</div></section>
      )}
      {(user.permissions.has("coupons:create") || user.permissions.has("coupons:edit")) && (
        <section><h2 className="mb-3 font-display text-xl font-bold text-navy">Coupons</h2><div className="space-y-2">{[...coupons, null].map((c) => (
          <form key={c?.id ?? "new"} action={saveCoupon} className="card flex flex-wrap items-end gap-2 p-3">{c && <input type="hidden" name="id" value={c.id} />}
            <div><label className="label" htmlFor={`cc-${c?.id}`}>Code</label><input id={`cc-${c?.id}`} name="code" defaultValue={c?.code} required className="input !min-h-9 !w-32 uppercase" /></div>
            <div><label className="label" htmlFor={`cp-${c?.id}`}>% off</label><input id={`cp-${c?.id}`} name="percent" defaultValue={c?.percentBps ? c.percentBps / 100 : ""} className="input !min-h-9 !w-20" /></div>
            <div><label className="label" htmlFor={`ca-${c?.id}`}>or ₦ off</label><input id={`ca-${c?.id}`} name="amountNaira" defaultValue={c?.amountOff ? Number(c.amountOff) / 100 : ""} className="input !min-h-9 !w-28" /></div>
            <div><label className="label" htmlFor={`cm-${c?.id}`}>Min spend ₦</label><input id={`cm-${c?.id}`} name="minSpendNaira" defaultValue={c ? Number(c.minSpend) / 100 : 0} className="input !min-h-9 !w-28" /></div>
            <div><label className="label" htmlFor={`cu-${c?.id}`}>Max uses</label><input id={`cu-${c?.id}`} name="maxUses" defaultValue={c?.maxUses ?? ""} className="input !min-h-9 !w-20" /></div>
            <label className="flex min-h-9 items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={c?.isActive} /> Active</label>
            <button className="btn-primary !min-h-9 !px-3 text-xs">{c ? "Save" : "Add coupon"}</button>{c && <span className="text-xs text-muted">used {c.used}×</span>}</form>))}</div></section>
      )}
    </>
  );
}
