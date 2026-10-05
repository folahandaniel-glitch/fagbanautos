"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAnyPermission, AuthError } from "@/lib/auth/guard";
import { nairaToKobo } from "@/lib/money";

const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
function go(path: string, kind: "notice" | "error", msg: string): never { redirect(`${path}?${kind}=${encodeURIComponent(msg)}`); }
async function need(path: string, ...perms: string[]) {
  try { return await requireAnyPermission(...perms); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}?error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
}
const CMS = ["content:edit", "content:manage", "settings:manage"];

export async function savePage(formData: FormData) {
  const path = "/admin/cms";
  const user = await need(path, ...CMS);
  const slug = slugify(str(formData.get("slug")));
  const title = str(formData.get("title"));
  if (!slug || !title) go(path, "error", "A page needs a slug and title.");
  const before = await db.cmsPage.findUnique({ where: { slug } });
  await db.cmsPage.upsert({ where: { slug }, create: { slug, title, body: str(formData.get("body")), seoTitle: str(formData.get("seoTitle")) || null, seoDescription: str(formData.get("seoDescription")) || null, published: formData.get("published") === "on" }, update: { title, body: str(formData.get("body")), seoTitle: str(formData.get("seoTitle")) || null, seoDescription: str(formData.get("seoDescription")) || null, published: formData.get("published") === "on" } });
  await audit({ actorId: user.id, action: before ? "cms.page_update" : "cms.page_create", targetType: "CmsPage", targetId: slug });
  revalidatePath("/", "layout");
  go(path, "notice", "Page saved.");
}

export async function saveFaq(formData: FormData) {
  const path = "/admin/cms";
  const user = await need(path, ...CMS);
  const id = str(formData.get("id"));
  if (formData.get("delete") === "1" && id) { await db.faq.delete({ where: { id } }); await audit({ actorId: user.id, action: "cms.faq_delete", targetType: "Faq", targetId: id }); go(path, "notice", "FAQ deleted."); }
  const data = { question: str(formData.get("question")), answer: str(formData.get("answer")), sortOrder: Number(str(formData.get("sortOrder")) || 0) };
  if (data.question.length < 3 || data.answer.length < 3) go(path, "error", "Question and answer are required.");
  const f = id ? await db.faq.update({ where: { id }, data }) : await db.faq.create({ data });
  await audit({ actorId: user.id, action: id ? "cms.faq_update" : "cms.faq_create", targetType: "Faq", targetId: f.id });
  revalidatePath("/faq");
  go(path, "notice", "FAQ saved.");
}

export async function saveMenuItem(formData: FormData) {
  const path = "/admin/cms";
  const user = await need(path, ...CMS);
  const id = str(formData.get("id"));
  if (formData.get("delete") === "1" && id) { await db.menuItem.delete({ where: { id } }); await audit({ actorId: user.id, action: "cms.menu_delete", targetType: "MenuItem", targetId: id }); revalidatePath("/", "layout"); go(path, "notice", "Menu item deleted."); }
  const href = str(formData.get("href"));
  if (!/^(\/|https:\/\/)/.test(href)) go(path, "error", "Links must start with / or https://");
  const data = { menu: "primary", label: str(formData.get("label")), href, sortOrder: Number(str(formData.get("sortOrder")) || 0), isVisible: formData.get("isVisible") === "on" };
  if (!data.label) go(path, "error", "A menu item needs a label.");
  const m = id ? await db.menuItem.update({ where: { id }, data }) : await db.menuItem.create({ data });
  await audit({ actorId: user.id, action: id ? "cms.menu_update" : "cms.menu_create", targetType: "MenuItem", targetId: m.id });
  revalidatePath("/", "layout");
  go(path, "notice", "Menu saved.");
}

export async function saveBanner(formData: FormData) {
  const path = "/admin/cms";
  const user = await need(path, "banners:edit", "banners:create", ...CMS);
  const id = str(formData.get("id"));
  if (formData.get("delete") === "1" && id) { await db.banner.delete({ where: { id } }); go(path, "notice", "Banner deleted."); }
  const data = { placement: str(formData.get("placement")) || "home-hero", title: str(formData.get("title")), subtitle: str(formData.get("subtitle")) || null, imageUrl: str(formData.get("imageUrl")) || null, ctaLabel: str(formData.get("ctaLabel")) || null, ctaHref: str(formData.get("ctaHref")) || null, isActive: formData.get("isActive") === "on", sortOrder: Number(str(formData.get("sortOrder")) || 0) };
  if (!data.title) go(path, "error", "A banner needs a title.");
  if (data.ctaHref && !/^(\/|https:\/\/)/.test(data.ctaHref)) go(path, "error", "Button links must start with / or https://");
  const b = id ? await db.banner.update({ where: { id }, data }) : await db.banner.create({ data });
  await audit({ actorId: user.id, action: id ? "cms.banner_update" : "cms.banner_create", targetType: "Banner", targetId: b.id });
  go(path, "notice", "Banner saved.");
}

export async function saveCoupon(formData: FormData) {
  const path = "/admin/cms";
  const user = await need(path, "coupons:create", "coupons:edit", "campaigns:edit");
  const id = str(formData.get("id"));
  const code = str(formData.get("code")).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3) go(path, "error", "Coupon codes need at least 3 letters or digits.");
  const percent = str(formData.get("percent")), amount = str(formData.get("amountNaira"));
  if ((percent && amount) || (!percent && !amount)) go(path, "error", "Set either a percentage or a fixed amount.");
  const data = { code, percentBps: percent ? Math.round(Number(percent) * 100) : null, amountOff: amount ? BigInt(nairaToKobo(Number(amount))) : null, minSpend: BigInt(nairaToKobo(Number(str(formData.get("minSpendNaira")) || 0))), maxUses: str(formData.get("maxUses")) ? Number(str(formData.get("maxUses"))) : null, isActive: formData.get("isActive") === "on" };
  if (data.percentBps != null && (data.percentBps < 1 || data.percentBps > 10000)) go(path, "error", "Percentage must be between 0.01 and 100.");
  const c = id ? await db.coupon.update({ where: { id }, data }) : await db.coupon.create({ data });
  await audit({ actorId: user.id, action: id ? "marketing.coupon_update" : "marketing.coupon_create", targetType: "Coupon", targetId: c.id, after: { code: c.code, isActive: c.isActive } });
  go(path, "notice", "Coupon saved.");
}

export async function saveDivision(formData: FormData) {
  const path = "/admin/divisions";
  const user = await need(path, "divisions:create", "divisions:edit", "settings:manage");
  const id = str(formData.get("id"));
  const name = str(formData.get("name"));
  if (name.length < 3) go(path, "error", "A division needs a name.");
  const data = { name, tagline: str(formData.get("tagline")) || null, description: str(formData.get("description")) || null, icon: str(formData.get("icon")) || null, accent: /^#[0-9a-fA-F]{6}$/.test(str(formData.get("accent"))) ? str(formData.get("accent")) : null, sortOrder: Number(str(formData.get("sortOrder")) || 0), isVisible: formData.get("isVisible") === "on" };
  const before = id ? await db.division.findUnique({ where: { id } }) : null;
  const d = id ? await db.division.update({ where: { id }, data }) : await db.division.create({ data: { ...data, slug: slugify(str(formData.get("slug")) || name) } });
  await audit({ actorId: user.id, action: id ? "division.update" : "division.create", targetType: "Division", targetId: d.id, before: before ? { name: before.name, isVisible: before.isVisible, sortOrder: before.sortOrder } : undefined, after: { name: d.name, isVisible: d.isVisible, sortOrder: d.sortOrder } });
  revalidatePath("/", "layout");
  go(path, "notice", "Division saved.");
}
