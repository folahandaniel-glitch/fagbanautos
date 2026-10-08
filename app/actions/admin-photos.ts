"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, AuthError } from "@/lib/auth/guard";
import { encryptSecret } from "@/lib/crypto";
import { setSetting } from "@/lib/settings";

const P = "/admin/photos";
const go = (kind: "notice" | "error", msg: string): never => redirect(`${P}?${kind}=${encodeURIComponent(msg)}`);

async function need() {
  try { return await requirePermission("settings:manage"); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${P}?error=${encodeURIComponent("Only a Super Admin or an assigned settings manager can change this.")}`); throw e; }
}

export async function savePhotoSettings(formData: FormData) {
  const user = await need();
  await setSetting("images.autoSearch", formData.get("autoSearch") === "on", user.id);
  await setSetting("images.vendorOnly", formData.get("vendorOnly") === "on", user.id);
  const key = String(formData.get("braveKey") ?? "").trim();
  if (key) {
    if (!/^[A-Za-z0-9_\-]{16,200}$/.test(key)) go("error", "That does not look like a Brave Search API key.");
    await setSetting("images.braveKeyEnc", encryptSecret(key), user.id, "Photo search key updated");
  }
  if (formData.get("clearKey") === "on") await setSetting("images.braveKeyEnc", "", user.id, "Photo search key removed");
  await audit({ actorId: user.id, action: "photos.settings", targetType: "Setting", targetId: "images" });
  revalidatePath(P);
  go("notice", "Saved.");
}

/** Lets the batch run again for listings that were checked and had nothing found. */
export async function recheckAll() {
  const user = await need();
  const r = await db.product.updateMany({ where: { needsImage: true }, data: { photoCheckedAt: null } });
  await audit({ actorId: user.id, action: "photos.recheck", targetType: "Product", targetId: "all", after: { count: r.count } });
  revalidatePath(P);
  go("notice", `${r.count} listings will be searched again.`);
}
