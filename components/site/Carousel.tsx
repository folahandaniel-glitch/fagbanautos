"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SmartImage } from "@/components/ui/media";
import type { CarouselSlide } from "@/lib/site-content";

const HIDDEN_ON = ["/cart", "/checkout", "/account", "/orders", "/pay", "/offline"];

/** Big animated banner shown under the header on public pages. Slides are managed in Admin > Carousel. */
export function Carousel({ slides, seconds }: { slides: CarouselSlide[]; seconds: number }) {
  const path = usePathname() ?? "/";
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useSyncExternalStore(
    (cb) => { const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused || reduced) return;
    const t = setTimeout(() => go(i + 1), Math.max(3, seconds) * 1000);
    return () => clearTimeout(t);
  }, [i, n, paused, reduced, seconds, go]);

  if (n === 0 || HIDDEN_ON.some((p) => path === p || path.startsWith(p + "/"))) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured cars and accessories"
      className="relative isolate w-full overflow-hidden bg-navy"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <style>{`@keyframes fag-kenburns{from{transform:scale(1)}to{transform:scale(1.08)}}@keyframes fag-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}.fag-kb{animation:fag-kenburns 9s ease-out forwards}.fag-rise{animation:fag-rise .7s .15s ease-out both}@media (prefers-reduced-motion:reduce){.fag-kb,.fag-rise{animation:none}}`}</style>
      <div className="relative h-[52vh] min-h-[320px] w-full sm:h-[58vh] sm:max-h-[640px] lg:h-[62vh]">
        {slides.map((s, idx) => {
          const active = idx === i;
          return (
            <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${n}`} aria-hidden={!active} className={`absolute inset-0 transition-opacity duration-700 ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}>
              <div key={active ? "on" : "off"} className={`absolute inset-0 ${active ? "fag-kb" : ""}`}>
                <SmartImage src={s.imageUrl} alt={s.imageAlt} className="h-full w-full object-cover" sizes="100vw" priority={idx === 0} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-navy/85 via-navy/45 to-transparent" aria-hidden="true" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-transparent" aria-hidden="true" />
              {active && (
                <div className="container-x absolute inset-0 flex flex-col justify-end pb-14 sm:justify-center sm:pb-0">
                  <div className="fag-rise max-w-xl text-white">
                    {s.badge && <span className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy">{s.badge}</span>}
                    <h2 className="font-display text-2xl font-extrabold leading-tight drop-shadow sm:text-4xl lg:text-5xl">{s.title}</h2>
                    {s.subtitle && <p className="mt-2 text-sm text-white/90 sm:mt-3 sm:text-lg">{s.subtitle}</p>}
                    {s.ctaHref && s.ctaLabel && <Link href={s.ctaHref} className="btn-primary mt-4 inline-flex sm:mt-6">{s.ctaLabel}</Link>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(i - 1)} aria-label="Previous slide" className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-xl text-white backdrop-blur transition hover:bg-white/35 sm:flex">‹</button>
            <button type="button" onClick={() => go(i + 1)} aria-label="Next slide" className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-xl text-white backdrop-blur transition hover:bg-white/35 sm:flex">›</button>
            <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2" role="tablist" aria-label="Choose slide">
              {slides.map((s, idx) => (
                <button key={s.id} type="button" role="tab" aria-selected={idx === i} aria-label={`Show slide ${idx + 1}: ${s.title}`} onClick={() => go(idx)} className="flex h-6 items-center px-0.5">
                  <span className={`block h-2 rounded-full transition-all ${idx === i ? "w-8 bg-accent" : "w-2 bg-white/60"}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
