"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, AuthError } from "@/lib/auth/guard";
import { DEFAULT_TEAM } from "@/lib/site-content";

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
function go(path: string, kind: "notice" | "error", msg: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}
async function need(path: string) {
  try { return await requirePermission("content:edit"); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}?error=${encodeURIComponent("You do not have permission to edit site content.")}`); throw e; }
}
const done = () => { revalidatePath("/", "layout"); };

/** Picture links must be https, or a path on this site (uploads and generated artwork). */
const url = z.string().max(1000).refine((u) => /^https:\/\//.test(u) || /^\/(api|brand|images)\//.test(u), "Picture must be an uploaded file or an https link");
const link = z.string().max(300).refine((u) => u === "" || /^\/(?!\/)/.test(u) || /^https:\/\//.test(u), "Link must start with / or https://");

const slideSchema = z.object({ title: z.string().min(2).max(120), subtitle: z.string().max(240), badge: z.string().max(40), imageUrl: url, imageAlt: z.string().max(200), ctaLabel: z.string().max(40), ctaHref: link });

export async function saveSlide(formData: FormData) {
  const P = "/admin/carousel";
  const user = await need(P);
  const id = str(formData.get("id"));
  const parsed = slideSchema.safeParse({ title: str(formData.get("title")), subtitle: str(formData.get("subtitle")), badge: str(formData.get("badge")), imageUrl: str(formData.get("imageUrl")), imageAlt: str(formData.get("imageAlt")), ctaLabel: str(formData.get("ctaLabel")), ctaHref: str(formData.get("ctaHref")) });
  if (!parsed.success) go(P, "error", parsed.error.issues[0]?.message ?? "Please check the slide details.");
  const d = parsed.data;
  const data = { title: d.title, subtitle: d.subtitle || null, badge: d.badge || null, imageUrl: d.imageUrl, imageAlt: d.imageAlt || null, ctaLabel: d.ctaLabel || null, ctaHref: d.ctaHref || null, active: formData.get("active") === "on" };
  if (id) await db.slide.update({ where: { id }, data });
  else {
    const last = await db.slide.aggregate({ _max: { sortOrder: true } });
    await db.slide.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  }
  await audit({ actorId: user.id, action: id ? "slide.update" : "slide.create", targetType: "Slide", targetId: id || "new", after: { title: d.title } });
  done();
  go(P, "notice", id ? "Slide saved." : "Slide added.");
}

async function reorder(ids: string[], id: string, dir: string, update: (id: string, i: number) => Promise<unknown>) {
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, n) => update(x, n)));
}

export async function moveSlide(formData: FormData) {
  await need("/admin/carousel");
  const rows = await db.slide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  await reorder(rows.map((r) => r.id), str(formData.get("id")), str(formData.get("dir")), (id, n) => db.slide.update({ where: { id }, data: { sortOrder: n } }));
  done();
  go("/admin/carousel", "notice", "Order updated.");
}

export async function deleteSlide(formData: FormData) {
  const user = await need("/admin/carousel");
  const id = str(formData.get("id"));
  await db.slide.delete({ where: { id } }).catch(() => null);
  await audit({ actorId: user.id, action: "slide.delete", targetType: "Slide", targetId: id });
  done();
  go("/admin/carousel", "notice", "Slide deleted.");
}

const memberSchema = z.object({ name: z.string().min(2).max(120), role: z.string().min(2).max(120), bio: z.string().max(2000), photoUrl: url.or(z.literal("")) });

export async function saveMember(formData: FormData) {
  const P = "/admin/team";
  const user = await need(P);
  const id = str(formData.get("id"));
  const parsed = memberSchema.safeParse({ name: str(formData.get("name")), role: str(formData.get("role")), bio: str(formData.get("bio")), photoUrl: str(formData.get("photoUrl")) });
  if (!parsed.success) go(P, "error", parsed.error.issues[0]?.message ?? "Please check the details.");
  const d = parsed.data;
  const data = { name: d.name, role: d.role, bio: d.bio || null, photoUrl: d.photoUrl || null, active: formData.get("active") === "on" };
  if (id) await db.teamMember.update({ where: { id }, data });
  else {
    const last = await db.teamMember.aggregate({ _max: { sortOrder: true } });
    await db.teamMember.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  }
  await audit({ actorId: user.id, action: id ? "team.update" : "team.create", targetType: "TeamMember", targetId: id || "new", after: { name: d.name } });
  done();
  go(P, "notice", id ? "Saved." : "Person added.");
}

export async function moveMember(formData: FormData) {
  await need("/admin/team");
  const rows = await db.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  await reorder(rows.map((r) => r.id), str(formData.get("id")), str(formData.get("dir")), (id, n) => db.teamMember.update({ where: { id }, data: { sortOrder: n } }));
  done();
  go("/admin/team", "notice", "Order updated.");
}

export async function deleteMember(formData: FormData) {
  const user = await need("/admin/team");
  const id = str(formData.get("id"));
  await db.teamMember.delete({ where: { id } }).catch(() => null);
  await audit({ actorId: user.id, action: "team.delete", targetType: "TeamMember", targetId: id });
  done();
  go("/admin/team", "notice", "Person removed.");
}

/** Creates the two founder cards so they can be edited (the About page shows them from code until then). */
export async function createFounderCards() {
  const user = await need("/admin/team");
  if ((await db.teamMember.count()) === 0) {
    await db.teamMember.createMany({ data: DEFAULT_TEAM.map((m, i) => ({ name: m.name, role: m.role, bio: m.bio, sortOrder: i })) });
    await audit({ actorId: user.id, action: "team.seed", targetType: "TeamMember", targetId: "founders" });
  }
  done();
  go("/admin/team", "notice", "Founder cards created. Add each picture and review the wording.");
}
