"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SmartImage } from "@/components/ui/media";
import { deleteImage, makePrimary, moveImage, saveAlt, autoFindPhotos, addImageByLink, refindPhotos, useIllustration } from "@/app/actions/admin-images";

export interface ManagedImage { id: string; url: string; alt: string | null; credit: string | null; sourceUrl: string | null; isPlaceholder: boolean; width: number | null; height: number | null; bytes: number | null }

const MAX_EDGE = 2000; // pixels; the server then fits it inside 1600x1200 as WebP

/** Shrinks a photo in the browser before upload: far less data, faster upload, and it fits Vercel's request-size limit. */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file; // the server will still validate and compress it
  }
}

export function ImageManager({ productId, images, canEdit, productName }: { productId: string; images: ManagedImage[]; canEdit: boolean; productName: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLog([]);
    let done = 0;
    for (const f of Array.from(files)) {
      setBusy(`Uploading ${++done} of ${files.length}…`);
      try {
        const small = await shrink(f);
        const fd = new FormData();
        fd.set("productId", productId);
        fd.set("file", small);
        const res = await fetch("/api/admin/product-images", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { error?: string; kb?: number };
        setLog((l) => [...l, res.ok ? { ok: true, text: `${f.name}: saved (${json.kb} KB)` } : { ok: false, text: `${f.name}: ${json.error ?? "failed"}` }]);
      } catch {
        setLog((l) => [...l, { ok: false, text: `${f.name}: network error` }]);
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  const real = images.filter((i) => !i.isPlaceholder).length;
  return (
    <section id="photos" className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy">Photos</h2>
        <span className="text-xs text-muted">{real} real photo{real === 1 ? "" : "s"}{images.length > real ? " + placeholder" : ""} · saved as compressed WebP, max 1600 px</span>
      </div>
      {images.length === 0 ? <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">No photos yet. Upload some, or let the system find licensed photos.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((img, i) => (
            <li key={img.id} className="rounded-xl border border-line p-2">
              <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-brand-50"><SmartImage src={img.url} alt={img.alt ?? productName} className="h-full w-full object-cover" sizes="300px" /></div>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {i === 0 && <span className="chip">Main photo</span>}
                {img.isPlaceholder ? <span className="badge-gold">Illustration</span> : null}
                {!img.isPlaceholder && img.sourceUrl ? <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-warn/15 px-2 py-0.5 font-semibold text-warn" title="Found automatically. Open the page it came from and check it suits this product.">Auto-found: check</a> : null}
                {img.bytes ? <span className="text-muted">{Math.round(img.bytes / 1024)} KB{img.width ? ` · ${img.width}×${img.height}` : ""}</span> : null}
              </p>
              {canEdit && (
                <div className="mt-2 space-y-2">
                  <form action={saveAlt} className="space-y-1.5">
                    <input type="hidden" name="imageId" value={img.id} />
                    <label className="sr-only" htmlFor={`alt-${img.id}`}>Description (alt text)</label>
                    <input id={`alt-${img.id}`} name="alt" defaultValue={img.alt ?? ""} placeholder="Describe the photo (helps accessibility and SEO)" className="input !min-h-9 text-xs" />
                    <label className="sr-only" htmlFor={`cr-${img.id}`}>Photo credit</label>
                    <input id={`cr-${img.id}`} name="credit" defaultValue={img.credit ?? ""} placeholder="Photo credit (required for some licences)" className="input !min-h-9 text-xs" />
                    <button className="btn-ghost !min-h-8 !px-3 text-xs">Save details</button>
                  </form>
                  <div className="flex flex-wrap gap-1.5">
                    {i > 0 && <form action={makePrimary}><input type="hidden" name="imageId" value={img.id} /><button className="btn-ghost !min-h-8 !px-3 text-xs">Make main</button></form>}
                    {i > 0 && <form action={moveImage}><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="dir" value="up" /><button className="btn-ghost !min-h-8 !px-3 text-xs" aria-label="Move earlier">←</button></form>}
                    {i < images.length - 1 && <form action={moveImage}><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="dir" value="down" /><button className="btn-ghost !min-h-8 !px-3 text-xs" aria-label="Move later">→</button></form>}
                    <form action={deleteImage}><input type="hidden" name="imageId" value={img.id} /><button className="rounded-xl px-3 text-xs font-semibold text-danger hover:bg-danger/10">Delete</button></form>
                  </div>
                </div>
              )}
              {img.credit && !canEdit && <p className="mt-1 text-[11px] text-muted">{img.credit}</p>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="space-y-4 border-t border-line pt-4">
          <div>
            <label className="label" htmlFor="photo-files">Upload photos (JPG, PNG or WebP; several at once)</label>
            <input ref={input} id="photo-files" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files)} disabled={!!busy} className="input !py-2" />
            <p className="mt-1 text-xs text-muted">Photos are shrunk in your browser and compressed again on the server, so large camera photos are fine. The first photo is the main one.</p>
            {busy && <p role="status" className="mt-2 text-sm font-medium text-brand">{busy}</p>}
            {log.length > 0 && <ul className="mt-2 space-y-0.5 text-xs">{log.map((l, i) => <li key={i} className={l.ok ? "text-ok" : "text-danger"}>{l.text}</li>)}</ul>}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <form action={autoFindPhotos}><input type="hidden" name="productId" value={productId} /><button className="btn-primary">Find photos automatically</button></form>
            <form action={refindPhotos}><input type="hidden" name="productId" value={productId} /><button className="btn-ghost" title="Removes photos the system found earlier and searches again. Your uploads are kept.">Search again</button></form>
            <form action={useIllustration}><input type="hidden" name="productId" value={productId} /><button className="btn-ghost" title="Remove automatic photos, show the illustration and stop searching">Use the illustration</button></form>
            <form action={addImageByLink} className="flex flex-1 items-end gap-2"><input type="hidden" name="productId" value={productId} />
              <div className="flex-1"><label className="label" htmlFor="img-link">Or add a photo from a link</label><input id="img-link" name="url" type="url" placeholder="https://…" className="input" /></div>
              <button className="btn-ghost">Add</button></form>
          </div>
          <p className="text-xs text-muted">Automatic photos come from Wikimedia Commons under licences that allow commercial use; credits are saved and shown on the product page. Always check that a photo really suits the product.</p>
        </div>
      )}
    </section>
  );
}
