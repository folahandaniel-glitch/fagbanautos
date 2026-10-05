"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "native" | "ios" | "unsupported";

const KEY = "fagdan_install_dismissed_at";

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable (private mode): prompt simply may reappear */ }
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => console.warn("Service worker registration failed", err));
  }, []);
  return null;
}

interface Props { enabled: boolean; delaySec: number; frequencyDays: number; message: string; appName: string }

/**
 * Install prompt. Uses the native event where the browser exposes it (Chromium on Android/desktop),
 * shows Share > Add to Home Screen steps on iOS Safari, and an honest message elsewhere.
 * Never shown when already installed, during checkout, or within `frequencyDays` of a dismissal.
 */
export function InstallPrompt({ enabled, delaySec, frequencyDays, message, appName }: Props) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafariLike = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
    const onHandler = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); setPlatform("native"); };
    window.addEventListener("beforeinstallprompt", onHandler);
    window.addEventListener("appinstalled", () => setOpen(false));
    const iosTimer = isIos && isSafariLike ? window.setTimeout(() => setPlatform("ios"), 0) : undefined;

    const dismissed = Number(safeGet(KEY) ?? 0);
    const cooledDown = !dismissed || Date.now() - dismissed > frequencyDays * 86_400_000;
    const t = window.setTimeout(() => {
      const inCheckout = /^\/(checkout|pay|admin|account)/.test(window.location.pathname);
      if (cooledDown && !inCheckout) setOpen(true);
    }, Math.max(0, delaySec) * 1000);
    return () => { window.removeEventListener("beforeinstallprompt", onHandler); window.clearTimeout(t); if (iosTimer) window.clearTimeout(iosTimer); };
  }, [enabled, delaySec, frequencyDays]);

  if (!open) return null;
  const dismiss = () => { safeSet(KEY, String(Date.now())); setOpen(false); };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "dismissed") safeSet(KEY, String(Date.now()));
    setOpen(false);
  };

  return (
    <div role="dialog" aria-labelledby="install-title" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-line bg-white p-5 shadow-2xl md:bottom-6 md:left-auto md:right-6">
      <p id="install-title" className="font-display text-sm font-bold uppercase tracking-wide text-brand">Install {appName}</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {platform === "ios" && (
        <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-ink">
          On iPhone or iPad: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </p>
      )}
      {platform === "unsupported" && (
        <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-ink">
          Your browser does not currently support automatic installation. You can still use FAGDAN normally.
        </p>
      )}
      <div className="mt-4 flex gap-3">
        {platform === "native" && <button onClick={install} className="btn-primary flex-1">INSTALL APP</button>}
        <button onClick={dismiss} className="btn-ghost flex-1">NOT NOW</button>
      </div>
    </div>
  );
}
