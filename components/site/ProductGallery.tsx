"use client";

import { useCallback, useEffect, useState } from "react";
import { SmartImage } from "@/components/ui/media";

export interface GalleryImage { id: string; url: string; alt: string | null; credit: string | null; sourceUrl: string | null }

/** Several photos per product: large view, thumbnails, keyboard arrows and a full-screen viewer. Photo credits are shown where a licence requires them. */
export function ProductGallery({ images, name, aspect = "aspect-[3/2]" }: { images: GalleryImage[]; name: string; aspect?: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = images.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, go]);

  if (n === 0) return <div className={`card grid ${aspect} place-items-center bg-brand-50 text-sm text-muted`}>Photo coming soon</div>;
  const cur = images[i];
  return (
    <figure>
      <div className="card group relative overflow-hidden">
        <button type="button" onClick={() => setOpen(true)} className={`relative block w-full ${aspect} bg-brand-50`} aria-label={`Open photo ${i + 1} of ${n} full screen`}>
          <SmartImage src={cur.url} alt={cur.alt ?? name} className="h-full w-full object-cover" priority sizes="(max-width:1024px) 100vw, 60vw" />
        </button>
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow hover:bg-white">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow hover:bg-white">›</button>
            <span className="absolute bottom-3 right-3 rounded-full bg-navy/80 px-2.5 py-1 text-xs font-semibold text-white" aria-live="polite">{i + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5" aria-label="Photo thumbnails">
          {images.map((img, idx) => (
            <li key={img.id}>
              <button type="button" onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1}`} aria-current={idx === i} className={`card relative block aspect-[3/2] w-full overflow-hidden ${idx === i ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100"}`}>
                <SmartImage src={img.url} alt="" className="h-full w-full object-cover" sizes="120px" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur.credit && (
        <figcaption className="mt-2 text-xs text-muted">
          Photo: {cur.credit}{cur.sourceUrl && <> · <a href={cur.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">source</a></>}
        </figcaption>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label={`${name} photos`} className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.url} alt={cur.alt ?? name} className="max-h-[88vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-navy">Close</button>
          {n > 1 && (<>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo" className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-navy">‹</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo" className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl text-navy">›</button>
          </>)}
        </div>
      )}
    </figure>
  );
}
