import Link from "next/link";

export function Pager({ page, pages, basePath, params }: { page: number; pages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link href={href(page - 1)} className="btn-ghost !min-h-10" rel="prev">Previous</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={n === page ? "btn-primary !min-h-10 !px-4" : "btn-ghost !min-h-10 !px-4"}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className="btn-ghost !min-h-10" rel="next">Next</Link>}
    </nav>
  );
}
