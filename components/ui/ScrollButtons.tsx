"use client";

import { useEffect, useState } from "react";

/** Floating "scroll up" and "scroll down" buttons for phones and small tablets. Hidden on large screens. */
export function ScrollButtons({ className = "" }: { className?: string }) {
  const [state, setState] = useState({ top: true, bottom: false, scrollable: false });

  useEffect(() => {
    // Direct updates (no animation-frame batching): React skips the re-render when nothing changed.
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const next = { scrollable: max > 200, top: window.scrollY < 120, bottom: window.scrollY > max - 120 };
      setState((prev) => (prev.scrollable === next.scrollable && prev.top === next.top && prev.bottom === next.bottom ? prev : next));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); ro.disconnect(); };
  }, []);

  if (!state.scrollable) return null;
  /** Smooth scroll, with an instant jump as a safety net if the browser did not animate (some embedded browsers and battery-saver modes). */
  const go = (target: "top" | "bottom") => {
    const top = target === "top" ? 0 : document.documentElement.scrollHeight;
    const start = window.scrollY;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduce ? "instant" : "smooth" });
    setTimeout(() => {
      if (!reduce && window.scrollY === start) window.scrollTo({ top, behavior: "instant" });
      window.dispatchEvent(new Event("scroll")); // refresh which buttons are enabled
    }, reduce ? 50 : 700);
  };
  const btn = "grid h-11 w-11 place-items-center rounded-full bg-navy/90 text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition active:scale-95 disabled:opacity-30";
  return (
    <div className={`fixed bottom-20 left-3 z-30 flex flex-col gap-2 lg:hidden ${className}`} role="group" aria-label="Scroll the page">
      <button type="button" className={btn} disabled={state.top} onClick={() => go("top")} aria-label="Scroll to top">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
      </button>
      <button type="button" className={btn} disabled={state.bottom} onClick={() => go("bottom")} aria-label="Scroll to bottom">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>
  );
}
