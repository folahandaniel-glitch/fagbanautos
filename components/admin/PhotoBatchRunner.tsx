"use client";

import { useRef, useState } from "react";

/** Finds real photos for waiting listings a few at a time, with a progress bar and a Stop button. Nothing runs while customers browse. */
export function PhotoBatchRunner({ initialRemaining, searchReady, canRun }: { initialRemaining: number; searchReady: boolean; canRun: boolean }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [total, setTotal] = useState(initialRemaining);
  const [found, setFound] = useState(0);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);

  async function run() {
    stop.current = false;
    setRunning(true);
    setMsg(null);
    setFound(0);
    setTotal(remaining);
    let last = remaining;
    let idle = 0;
    while (!stop.current) {
      const res = await fetch("/api/admin/photo-batch", { method: "POST" }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { processed?: number; found?: number; remaining?: number; error?: string } | null;
      if (!res || !res.ok || !json || json.error) { setMsg(json?.error ?? "The search could not continue. Try again in a few minutes."); break; }
      setFound((f) => f + (json.found ?? 0));
      setRemaining(json.remaining ?? 0);
      if ((json.remaining ?? 0) === 0) { setMsg("All listings have been checked."); break; }
      idle = (json.processed ?? 0) === 0 || json.remaining === last ? idle + 1 : 0;
      last = json.remaining ?? last;
      if (idle >= 3) { setMsg("The search stopped making progress (its allowance may be used up). It continues automatically each day."); break; }
    }
    setRunning(false);
  }

  const done = Math.max(0, total - remaining);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 100;
  return (
    <div className="space-y-3">
      <p className="text-sm"><strong className="text-navy">{remaining}</strong> listing{remaining === 1 ? "" : "s"} still show an illustration instead of a real photo.</p>
      {running && (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Photo search progress" className="h-3 w-full overflow-hidden rounded-full bg-brand-50">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {(running || found > 0) && <p role="status" className="text-sm text-muted">{running ? "Searching… " : ""}{found} photo set{found === 1 ? "" : "s"} found so far.</p>}
      {msg && <p role="status" className="text-sm font-medium text-brand">{msg}</p>}
      {canRun ? (
        <div className="flex gap-2">
          <button type="button" onClick={run} disabled={running || remaining === 0 || !searchReady} className="btn-primary">{running ? "Searching…" : "Find photos now"}</button>
          {running && <button type="button" onClick={() => { stop.current = true; }} className="btn-ghost">Stop</button>}
        </div>
      ) : <p className="text-sm text-muted">You can view progress but not start a search.</p>}
      {!searchReady && <p className="text-xs text-warn">Add a photo search key below first. Vendor-site and licensed photos are still tried when you add a product.</p>}
    </div>
  );
}
