"use client";

import { useState } from "react";

const MAX_EDGE = 2200;

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

/** A picture field for admin forms: choose a file (compressed and uploaded straight away) or paste a link. Submits the final URL as `name`. */
export function ImageField({ name, label, defaultValue = "", kind = "slide", required = false }: { name: string; label: string; defaultValue?: string | null; kind?: "slide" | "portrait"; required?: boolean }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const id = `img-${name}-${label.replace(/\W/g, "")}`;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const small = await shrink(file);
      const fd = new FormData();
      fd.set("file", small);
      fd.set("kind", kind);
      const res = await fetch("/api/admin/site-image", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string; kb?: number };
      if (res.ok && json.url) { setUrl(json.url); setMsg({ ok: true, text: `Uploaded (${json.kb} KB). Remember to save.` }); }
      else setMsg({ ok: false, text: json.error ?? "Upload failed." });
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    }
    setBusy(false);
  }

  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex flex-wrap items-start gap-3">
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-brand-50 ${kind === "portrait" ? "h-28 w-24" : "h-20 w-36"}`}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : <span className="px-2 text-center text-[11px] text-muted">No picture</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} className="input !py-2 text-sm" />
          <input name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="or paste an https:// picture link" className="input !min-h-9 text-xs" required={required} aria-label={`${label} link`} />
          {busy && <p role="status" className="text-xs font-medium text-brand">Compressing and uploading…</p>}
          {msg && <p className={`text-xs ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
        </div>
      </div>
    </div>
  );
}
