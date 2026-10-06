import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { saveMember, moveMember, deleteMember, createFounderCards } from "@/app/actions/admin-site";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";

export const metadata: Metadata = { title: "About and team", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TeamAdmin({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireStaffPage("content:view");
  const sp = await searchParams;
  const canEdit = user.permissions.has("content:edit");
  const [people, staff] = await Promise.all([db.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }), db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })]);
  const form = (m: (typeof people)[number] | null) => (
    <form action={saveMember} className="mt-3 grid gap-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <ImageField name="photoUrl" label="Portrait (a head-and-shoulders photo works best)" kind="portrait" defaultValue={m?.photoUrl} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`n-${m?.id}`}>Full name</label><input id={`n-${m?.id}`} name="name" defaultValue={m?.name} required maxLength={120} className="input" /></div>
        <div><label className="label" htmlFor={`r-${m?.id}`}>Title (for example Founder, Co-founder)</label><input id={`r-${m?.id}`} name="role" defaultValue={m?.role} required maxLength={120} className="input" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`bio-${m?.id}`}>About this person</label><textarea id={`bio-${m?.id}`} name="bio" defaultValue={m?.bio ?? ""} maxLength={2000} className="input min-h-28" /></div>
      </div>
      <div><label className="label" htmlFor={`u-${m?.id}`}>Linked login (lets this person edit their own card from Profile)</label><select id={`u-${m?.id}`} name="userId" defaultValue={m?.userId ?? ""} className="input"><option value="">Not linked</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={m?.active ?? true} className="h-4 w-4" /> Show on the About page</label>
      <div><button className="btn-primary">{m ? "Save" : "Add person"}</button></div>
    </form>
  );
  return (
    <>
      <PageHeader title="About and team" sub="People shown on the About page. The story and headings are edited in Settings > Page text." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      {people.length === 0 && (
        <div className="card mb-4 p-4">
          <p className="text-sm text-muted">The About page currently shows two founder cards without pictures. Create them here to add pictures and edit the wording.</p>
          {canEdit && <form action={createFounderCards} className="mt-3"><button className="btn-primary">Create the founder cards</button></form>}
        </div>
      )}
      <div className="space-y-3">
        {people.map((m, i) => (
          <details key={m.id} className="card p-4" open={i < 2 && !m.photoUrl}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-navy">{m.name} <span className="font-normal text-muted">· {m.role}</span> <Pill tone={m.active ? "ok" : "warn"}>{m.active ? "Showing" : "Hidden"}</Pill>{!m.photoUrl && <Pill tone="gold">No picture</Pill>}</summary>
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                {i > 0 && <form action={moveMember}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="up" /><button className="btn-ghost !min-h-8 !px-3 text-xs">Move earlier</button></form>}
                {i < people.length - 1 && <form action={moveMember}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="dir" value="down" /><button className="btn-ghost !min-h-8 !px-3 text-xs">Move later</button></form>}
                <form action={deleteMember}><input type="hidden" name="id" value={m.id} /><button className="rounded-xl px-3 text-xs font-semibold text-danger hover:bg-danger/10">Remove</button></form>
              </div>
            )}
            {canEdit && form(m)}
          </details>
        ))}
        {canEdit && <details className="card p-4"><summary className="cursor-pointer font-semibold text-brand">+ Add a person (director, manager, team member)</summary>{form(null)}</details>}
      </div>
    </>
  );
}
