import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader, Table, Pill } from "@/components/admin/ui";
import { Pager } from "@/components/ui/Pager";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };
export const dynamic = "force-dynamic";
const PAGE = 40;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; actor?: string; page?: string }> }) {
  await requireStaffPage("audit:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = { ...(sp.q ? { OR: [{ action: { contains: sp.q, mode: "insensitive" } }, { targetId: { contains: sp.q } }, { reason: { contains: sp.q, mode: "insensitive" } }] } : {}), ...(sp.actor ? { actorId: sp.actor } : {}) };
  const [rows, total, actors] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
    db.user.findMany({ where: { kind: "STAFF" }, select: { id: true, name: true } }),
  ]);
  const sensitive = (a: string) => /override|vat|bank|paystack|release|refund|role|admin\.|settings\./.test(a);
  return (
    <>
      <PageHeader title="Audit log" sub={`${total} entries. Append-only: entries cannot be edited or deleted, even by the database owner role used by the app.`} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="action, target id, reason" /></div>
        <div><label className="label" htmlFor="actor">Actor</label><select id="actor" name="actor" defaultValue={sp.actor ?? ""} className="input"><option value="">Anyone</option>{actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <button className="btn-primary">Filter</button>
      </form>
      <Table head={["When", "Actor", "Action", "Target", "Details"]}>
        {rows.map((r) => (
          <tr key={r.id} className="align-top">
            <td className="td whitespace-nowrap text-xs text-muted">{r.createdAt.toLocaleString("en-NG")}</td>
            <td className="td text-sm">{r.actor?.name ?? <span className="text-muted">system</span>}{r.ip && <span className="block text-xs text-muted">{r.ip}</span>}</td>
            <td className="td"><Pill tone={sensitive(r.action) ? "warn" : "info"}>{r.action}</Pill></td>
            <td className="td font-mono text-xs">{r.targetType}{r.targetId ? ` ${r.targetId.slice(0, 10)}` : ""}</td>
            <td className="td max-w-md text-xs text-muted">{r.reason && <p className="text-ink">Reason: {r.reason}</p>}{r.before != null && <p className="truncate">Before: {JSON.stringify(r.before)}</p>}{r.after != null && <p className="truncate">After: {JSON.stringify(r.after)}</p>}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE))} basePath="/admin/audit" params={{ q: sp.q, actor: sp.actor }} />
    </>
  );
}
