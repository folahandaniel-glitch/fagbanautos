"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAnyPermission, AuthError } from "@/lib/auth/guard";
import { autoPhotosForProduct, addOptimisedUpload } from "@/lib/images/library";
import { optimiseImage } from "@/lib/images/optimize";
import { fetchPublicImage } from "@/lib/images/safe-fetch";
import { storeFile } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";


function back(productId: string, kind: "notice" | "error", msg: string): never {
  redirect(`/admin/products/${productId}?${kind}=${encodeURIComponent(msg)}#photos`);
}

async function need(productId: string) {
  try { return await requireAnyPermission("products:edit", "vehicles:edit", "inventory:edit"); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `/admin/products/${productId}?error=${encodeURIComponent("You do not have permission to change photos.")}`); throw e; }
}

async function ownImage(imageId: string) {
  const img = await db.productImage.findUnique({ where: { id: imageId } });
  if (!img) redirect("/admin/inventory?error=Photo%20not%20found");
  return img;
}

/** Renumbers sortOrder 0..n-1 so ordering stays clean after any change. */
async function normalise(productId: string, orderedIds: string[]) {
  await db.$transaction(orderedIds.map((id, i) => db.productImage.update({ where: { id }, data: { sortOrder: i } })));
}

export async function deleteImage(formData: FormData) {
  const img = await ownImage(String(formData.get("imageId")));
  const user = await need(img.productId);
  await db.productImage.delete({ where: { id: img.id } });
  const rest = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" } });
  await normalise(img.productId, rest.map((r) => r.id));
  if (rest.length === 0) await db.product.update({ where: { id: img.productId }, data: { needsImage: true } });
  await audit({ actorId: user.id, action: "product.image_delete", targetType: "Product", targetId: img.productId, before: { url: img.url } });
  revalidatePath("/", "layout");
  back(img.productId, "notice", "Photo removed.");
}

export async function makePrimary(formData: FormData) {
  const img = await ownImage(String(formData.get("imageId")));
  const user = await need(img.productId);
  const all = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" } });
  await normalise(img.productId, [img.id, ...all.filter((a) => a.id !== img.id).map((a) => a.id)]);
  await audit({ actorId: user.id, action: "product.image_primary", targetType: "Product", targetId: img.productId, after: { imageId: img.id } });
  revalidatePath("/", "layout");
  back(img.productId, "notice", "Main photo changed.");
}

export async function moveImage(formData: FormData) {
  const img = await ownImage(String(formData.get("imageId")));
  await need(img.productId);
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const all = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" } });
  const ids = all.map((a) => a.id);
  const i = ids.indexOf(img.id), j = i + dir;
  if (j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; await normalise(img.productId, ids); }
  revalidatePath("/", "layout");
  back(img.productId, "notice", "Order updated.");
}

export async function saveAlt(formData: FormData) {
  const img = await ownImage(String(formData.get("imageId")));
  await need(img.productId);
  await db.productImage.update({ where: { id: img.id }, data: { alt: String(formData.get("alt") ?? "").trim().slice(0, 200) || null, credit: String(formData.get("credit") ?? "").trim().slice(0, 300) || null } });
  revalidatePath("/", "layout");
  back(img.productId, "notice", "Photo details saved.");
}

/** Automatic photo finder: real, licensed photographs matched to the product, compressed and credited. */
export async function autoFindPhotos(formData: FormData) {
  const productId = String(formData.get("productId"));
  const user = await need(productId);
  if (!(await rateLimit("auto-photos", 20, 600))) back(productId, "error", "Too many searches. Please wait a few minutes.");
  let added = 0;
  try { added = await autoPhotosForProduct(productId, 3); }
  catch (e) { console.error("[autoFindPhotos]", e); back(productId, "error", "The photo search service is not reachable right now. Please try again later or upload photos."); }
  await audit({ actorId: user.id, action: "product.image_auto", targetType: "Product", targetId: productId, after: { added } });
  revalidatePath("/", "layout");
  if (added === 0) back(productId, "error", "No suitable licensed photo was found for this item. Please upload your own photos.");
  back(productId, "notice", `${added} photo${added > 1 ? "s" : ""} added automatically. Please check they suit the product.`);
}

export async function addImageByLink(formData: FormData) {
  const productId = String(formData.get("productId"));
  const user = await need(productId);
  if (!(await rateLimit("image-link", 20, 600))) back(productId, "error", "Too many requests. Please wait a few minutes.");
  try {
    const raw = await fetchPublicImage(String(formData.get("url") ?? "").trim());
    const opt = await optimiseImage(raw);
    const p = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { images: true } });
    const url = await storeFile(opt.bytes, opt.ext, opt.mime, "products");
    await addOptimisedUpload(productId, { url, width: opt.width, height: opt.height, bytes: opt.bytes.length }, p.name, p.images.every((i) => i.isPlaceholder));
    await audit({ actorId: user.id, action: "product.image_add", targetType: "Product", targetId: productId, after: { via: "link" } });
  } catch (e) {
    back(productId, "error", e instanceof Error ? e.message.slice(0, 160) : "Could not add that image.");
  }
  revalidatePath("/", "layout");
  back(productId, "notice", "Photo added (compressed to WebP).");
}

/** Removes photos the system found by itself (they carry a source address). Photos you uploaded are never touched. */
async function removeAutoPhotos(productId: string) {
  const autos = await db.productImage.findMany({ where: { productId, isPlaceholder: false, sourceUrl: { not: null } } });
  if (autos.length) await db.productImage.deleteMany({ where: { id: { in: autos.map((a) => a.id) } } });
  return autos.length;
}

/** Search again for one product, replacing earlier automatic photos. */
export async function refindPhotos(formData: FormData) {
  const productId = String(formData.get("productId"));
  const user = await need(productId);
  if (!(await rateLimit("img-auto", 20, 600))) back(productId, "error", "Too many searches. Please wait a few minutes.");
  await removeAutoPhotos(productId);
  const n = await autoPhotosForProduct(productId, 3).catch(() => 0);
  const rest = await db.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" } });
  await normalise(productId, rest.map((r) => r.id));
  if (rest.length === 0) await db.product.update({ where: { id: productId }, data: { needsImage: true } });
  await audit({ actorId: user.id, action: "product.image_refind", targetType: "Product", targetId: productId, after: { added: n } });
  revalidatePath("/", "layout");
  back(productId, n ? "notice" : "error", n ? `Found ${n} new photo${n === 1 ? "" : "s"}.` : "No suitable photo was found. The illustration stays until you upload one.");
}

/** Go back to the generated illustration and stop searching for this product. */
export async function useIllustration(formData: FormData) {
  const productId = String(formData.get("productId"));
  const user = await need(productId);
  await removeAutoPhotos(productId);
  const p = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { vehicle: true, category: true, brand: true } });
  if ((await db.productImage.count({ where: { productId } })) === 0) {
    const url = p.vehicle
      ? `/api/placeholder?kind=vehicle&make=${encodeURIComponent(p.vehicle.makeName)}&model=${encodeURIComponent(p.vehicle.modelName)}&year=${p.vehicle.year}&colour=${encodeURIComponent(p.vehicle.colour ?? "")}&i=1`
      : `/api/placeholder?kind=product&label=${encodeURIComponent(p.category?.name ?? p.name.slice(0, 30))}&brand=${encodeURIComponent(p.brand?.name ?? "")}`;
    await db.productImage.create({ data: { productId, url, alt: `${p.name} (illustration)`, isPlaceholder: true } });
  }
  await db.product.update({ where: { id: productId }, data: { needsImage: false, photoCheckedAt: new Date() } });
  await audit({ actorId: user.id, action: "product.image_illustration", targetType: "Product", targetId: productId });
  revalidatePath("/", "layout");
  back(productId, "notice", "Using the generated illustration. Automatic search is off for this product.");
}
