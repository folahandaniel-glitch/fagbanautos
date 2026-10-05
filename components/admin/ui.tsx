import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-2xl font-extrabold text-navy">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "danger" }) {
  const c = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-navy";
  return (
    <div className="card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p><p className={`mt-1 break-words font-display text-xl font-extrabold sm:text-2xl ${c}`}>{value}</p>{sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}</div>
  );
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "ok"; children: ReactNode }) {
  const cls = kind === "error" ? "bg-danger/10 text-danger" : kind === "ok" ? "bg-ok/10 text-ok" : "bg-brand-50 text-ink";
  return <p role={kind === "error" ? "alert" : "status"} className={`mb-4 rounded-xl p-3 text-sm ${cls}`}>{children}</p>;
}

export function Pill({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "warn" | "danger" | "gold" }) {
  const cls = { info: "bg-brand-50 text-brand", ok: "bg-ok/10 text-ok", warn: "bg-warn/10 text-warn", danger: "bg-danger/10 text-danger", gold: "bg-accent/15 text-accent-600" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left"><thead className="border-b border-line bg-canvas"><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody></table>
      {empty && <p className="p-6 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}

/** Dependency-free SVG bar chart (accessible: values are also listed in the table below each chart where used). */
export function BarChart({ data, format, label }: { data: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 520, h = 180, pad = 28, bw = (w - pad * 2) / Math.max(1, data.length);
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h + 28}`} role="img" aria-label={label} className="w-full">
        {data.map((d, i) => {
          const bh = Math.round((d.value / max) * h);
          return (
            <g key={d.label}>
              <rect x={pad + i * bw + 6} y={h - bh + 8} width={bw - 12} height={bh} rx={6} fill="var(--brand)" opacity={0.9}><title>{`${d.label}: ${format(d.value)}`}</title></rect>
              <text x={pad + i * bw + bw / 2} y={h + 24} textAnchor="middle" fontSize="11" fill="#5b6475">{d.label}</text>
            </g>
          );
        })}
        <line x1={pad} y1={h + 8} x2={w - pad} y2={h + 8} stroke="#dde3ef" />
      </svg>
      <figcaption className="sr-only">{data.map((d) => `${d.label}: ${format(d.value)}`).join("; ")}</figcaption>
    </figure>
  );
}

export { Link };
