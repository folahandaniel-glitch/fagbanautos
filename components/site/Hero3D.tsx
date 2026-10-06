"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";

const CarScene = dynamic(() => import("./CarScene"), { ssr: false, loading: () => null });

type Tier = "high" | "medium" | "low";

/**
 * Capability detection. 3D is an enhancement only:
 *  high   -> full animated WebGL scene
 *  medium -> WebGL scene, rendered on demand with reduced motion
 *  low    -> no WebGL at all (static artwork). Also chosen for Save-Data, reduced motion, tiny screens or no WebGL.
 */
function detectTier(): Tier {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "low";
    if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? "")) return "low";
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "low";
    if (window.innerWidth < 640) return "low"; // lightweight mobile version
    const cores = nav.hardwareConcurrency ?? 2;
    const mem = nav.deviceMemory ?? 4;
    if (cores >= 8 && mem >= 8) return "high";
    if (cores >= 4 && mem >= 4) return "medium";
    return "low";
  } catch {
    return "low";
  }
}

export function Hero3D({ children, fallbackImage }: { children: React.ReactNode; fallbackImage?: string }) {
  const [tier, setTier] = useState<Tier>("low");
  const [failed, setFailed] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setTier(detectTier()), 0); return () => window.clearTimeout(t); }, []);
  const show3d = tier !== "low" && !failed;
  return (
    <div className="relative isolate overflow-hidden bg-navy text-white">
      <div className="hero-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div className="absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-brand/60 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-24 bottom-0 -z-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
      <div className="container-x grid items-center gap-8 py-14 lg:grid-cols-2 lg:py-24">
        <div>{children}</div>
        <div className="relative mx-auto aspect-[4/3] w-full max-w-xl" aria-hidden="true">
          {show3d ? (
            <ErrorBoundary onError={() => setFailed(true)}>
              <CarScene animate={tier === "high"} />
            </ErrorBoundary>
          ) : (
            <StaticCar src={fallbackImage} />
          )}
        </div>
      </div>
    </div>
  );
}

function StaticCar({ src }: { src?: string }) {
  // Lightweight fallback: layered CSS depth, no JS animation, no WebGL.
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="absolute bottom-6 h-6 w-4/5 rounded-full bg-black/40 blur-xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || "/api/placeholder?kind=vehicle&make=FAGDAN&model=AutoGallery&year=2026&colour=blue&i=1"} alt="" width={1200} height={800} className="drift h-full w-full rounded-3xl object-cover opacity-95 shadow-2xl" />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? <StaticCar /> : this.props.children; }
}
