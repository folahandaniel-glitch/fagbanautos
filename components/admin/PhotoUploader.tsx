"use client";

import { useState } from "react";

const MAX_EDGE = 2000;
const MAX_PHOTOS = 12;

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
    return file;
  }
}

/** Add-product picture box: pick several photos, each is compressed and uploaded straight away; the saved form then carries their addresses. */
export function PhotoUploader() {
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setErrors([]);
    let n = 0;
    for (const f of Array.from(files)) {
      if (urls.length + n >= MAX_PHOTOS) { setErrors((e) => [...e, `At most ${MAX_PHOTOS} pictures.`]); break; }
      setBusy(`Uploading ${n + 1} of ${files.length}…`);
      try {
        const fd = new FormData();
        fd.set("file", await shrink(f));
        fd.set("kind", "slide");
        const res = await fetch("/api/admin/site-image", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.ok && json.url) { const u = json.url; setUrls((x) => [...x, u]); n++; }
        else setErrors((e) => [...e, `${f.name}: ${json.error ?? "failed"}`]);
      } catch {
        setErrors((e) => [...e, `${f.name}: network error`]);
      }
    }
    setBusy(null);
  }

  return (
    <section className="card space-y-3 p-5" aria-labelledby="pu-h">
      <h2 id="pu-h" className="font-display text-lg font-bold text-navy">Pictures</h2>
      <p className="text-xs text-muted">Add as many as you like (up to {MAX_PHOTOS}). They are compressed automatically. The first is the main picture. If you add none, the system searches the vendor website and licensed libraries.</p>
      <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} disabled={!!busy} className="input !py-2 text-sm" aria-label="Add pictures" />
      {busy && <p role="status" className="text-xs font-medium text-brand">{busy}</p>}
      {errors.length > 0 && <ul className="text-xs text-danger">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      {urls.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {urls.map((u, i) => (
            <li key={u} className="relative">
              <input type="hidden" name="photoUrl" value={u} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Picture ${i + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-navy/80 px-1.5 text-[10px] text-white">Main</span>}
              <button type="button" onClick={() => setUrls((x) => x.filter((y) => y !== u))} aria-label={`Remove picture ${i + 1}`} className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs font-bold text-danger">×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
