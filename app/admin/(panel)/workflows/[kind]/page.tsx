import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { WORKFLOWS } from "@/lib/workflows";
import { updateWorkflow, createTask, createLead } from "@/app/actions/admin-workflows";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Workflow", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = { id: string; title: string; sub: string; status: string; extra?: React.ReactNode; fields?: { owner?: string | null; priority?: string; nextAction?: string | null; nextFollowUp?: Date | null } };

async function load(kind: string): Promise<Row[]> {
  const fmt = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  switch (kind) {
    case "leads": return (await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 80, include: { owner: { select: { name: true } } } })).map((l) => ({ id: l.id, title: l.name, sub: `${l.phone ?? ""} ${l.email ?? ""} · ${l.interest ?? ""} · ${l.source ?? ""} · owner ${l.owner?.name ?? "unassigned"}`, status: l.stage, fields: { owner: l.ownerId, priority: l.priority, nextAction: l.nextAction, nextFollowUp: l.nextFollowUpAt } }));
    case "tasks": return (await db.task.findMany({ orderBy: [{ status: "asc" }, { deadline: "asc" }], take: 80, include: { assignee: { select: { name: true } } } })).map((t) => ({ id: t.id, title: t.title, sub: `${t.assignee?.name ?? "unassigned"} · ${t.priority} · due ${t.deadline ? fmt(t.deadline) : "n/a"}`, status: t.status, fields: { owner: t.assigneeId } }));
    case "bookings": return (await db.serviceBooking.findMany({ orderBy: { slotStart: "desc" }, take: 80, include: { service: true, customer: true } })).map((b) => ({ id: b.id, title: `${b.service.name} · ${b.customer.name}`, sub: `${fmt(b.slotStart)} · ${b.location} · ${b.vehicleInfo}${b.notes ? ` · ${b.notes}` : ""}`, status: b.status }));
    case "imports": return (await db.importCase.findMany({ orderBy: { createdAt: "desc" }, take: 80, include: { customer: true } })).map((c) => ({ id: c.id, title: `${c.caseNumber} · ${c.year ?? ""} ${c.make} ${c.model}`, sub: `${c.customer.name} · from ${c.country} · budget ${c.budget ? formatNaira(Number(c.budget), { whole: true }) : "n/a"}`, status: c.status }));
    case "tradeins": return (await db.tradeIn.findMany({ orderBy: { createdAt: "desc" }, take: 80, include: { customer: true } })).map((t) => ({ id: t.id, title: `${t.year} ${t.make} ${t.model} · ${t.customer.name}`, sub: `${t.mileageKm ?? "?"} km · ${t.condition ?? ""} · valuation ${t.valuation ? formatNaira(Number(t.valuation), { whole: true }) : "pending"}`, status: t.status }));
    case "swaps": return (await db.swapRequest.findMany({ orderBy: { createdAt: "desc" }, take: 80, include: { customer: true } })).map((s) => ({ id: s.id, title: `${s.ownVehicle} · ${s.customer.name}`, sub: `cash difference ${s.cashDifference != null ? formatNaira(Number(s.cashDifference), { whole: true }) : "pending"}${s.notes ? ` · ${s.notes}` : ""}`, status: s.status }));
    case "finance": return (await db.financeApplication.findMany({ orderBy: { createdAt: "desc" }, take: 80, include: { customer: true } })).map((f) => ({ id: f.id, title: `${f.customer.name} · ${formatNaira(Number(f.requested), { whole: true })} over ${f.termMonths} months`, sub: `price ${formatNaira(Number(f.vehiclePrice), { whole: true })} · deposit ${formatNaira(Number(f.deposit), { whole: true })}${f.provider ? ` · provider ${f.provider}` : ""}`, status: f.status }));
    default: return [];
  }
}

export default async function WorkflowPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const { kind } = await params;
  const def = WORKFLOWS[kind];
  if (!def) notFound();
  const user = await requireStaffPage(def.view);
  const sp = await searchParams;
  const [rows, staff] = await Promise.all([load(kind), db.user.findMany({ where: { kind: "STAFF", status: "ACTIVE" }, select: { id: true, name: true } })]);
  const canEdit = user.permissions.has(def.edit);
  const counts = def.statuses.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));
  return (
    <>
      <PageHeader title={def.title} sub={`${rows.length} records`} actions={["bookings", "tradeins", "swaps", "imports"].includes(kind) && user.permissions.has(`${def.view.split(":")[0]}:export`) ? <Link href={`/admin/export/${kind === "bookings" ? "services" : kind}`} className="btn-ghost">Export Excel</Link> : undefined} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="mb-5 flex flex-wrap gap-2">{counts.map((c) => <Pill key={c.s} tone={c.n ? "info" : "warn"}>{c.s.replace(/_/g, " ")}: {c.n}</Pill>)}</div>

      {kind === "leads" && user.permissions.has("leads:create") && (
        <form action={createLead} className="card mb-5 grid gap-3 p-4 sm:grid-cols-5"><div><label className="label" htmlFor="ln">Name</label><input id="ln" name="name" required className="input" /></div><div><label className="label" htmlFor="lp">Phone</label><input id="lp" name="phone" className="input" /></div><div><label className="label" htmlFor="le">Email</label><input id="le" name="email" type="email" className="input" /></div><div><label className="label" htmlFor="li">Interest</label><input id="li" name="interest" className="input" /></div><div className="flex items-end"><button className="btn-primary w-full">Add lead</button></div></form>
      )}
      {kind === "tasks" && user.permissions.has("tasks:create") && (
        <form action={createTask} className="card mb-5 grid gap-3 p-4 sm:grid-cols-5"><div className="sm:col-span-2"><label className="label" htmlFor="tt">Title</label><input id="tt" name="title" required className="input" /></div><div><label className="label" htmlFor="ta">Assign to</label><select id="ta" name="assigneeId" className="input">{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="label" htmlFor="td">Deadline</label><input id="td" name="deadline" type="datetime-local" className="input" /></div><div className="flex items-end"><button className="btn-primary w-full">Add task</button></div></form>
      )}

      <div className="space-y-3">
        {rows.length === 0 && <p className="card p-6 text-center text-sm text-muted">Nothing here yet.</p>}
        {rows.map((r) => (
          <article key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-navy">{r.title}</h2><p className="text-sm text-muted">{r.sub}</p></div><Pill>{r.status.replace(/_/g, " ")}</Pill></div>
            {canEdit && (
              <form action={updateWorkflow} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={r.id} />
                <div><label className="label" htmlFor={`st-${r.id}`}>Status</label><select id={`st-${r.id}`} name="status" defaultValue={r.status} className="input !min-h-9">{def.statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
                {(def.extra === "lead" || def.extra === "task") && <div><label className="label" htmlFor={`ow-${r.id}`}>Owner</label><select id={`ow-${r.id}`} name="ownerId" defaultValue={r.fields?.owner ?? ""} className="input !min-h-9"><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
                {def.extra === "lead" && <><div><label className="label" htmlFor={`pr-${r.id}`}>Priority</label><select id={`pr-${r.id}`} name="priority" defaultValue={r.fields?.priority} className="input !min-h-9"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div><div><label className="label" htmlFor={`na-${r.id}`}>Next action</label><input id={`na-${r.id}`} name="nextAction" defaultValue={r.fields?.nextAction ?? ""} className="input !min-h-9" /></div><div><label className="label" htmlFor={`fu-${r.id}`}>Follow-up</label><input id={`fu-${r.id}`} name="nextFollowUpAt" type="date" defaultValue={r.fields?.nextFollowUp?.toISOString().slice(0, 10)} className="input !min-h-9" /></div></>}
                {def.extra === "valuation" && <div><label className="label" htmlFor={`va-${r.id}`}>Valuation (₦)</label><input id={`va-${r.id}`} name="valuationNaira" inputMode="decimal" className="input !min-h-9 !w-36" /></div>}
                {def.extra === "cash" && <div><label className="label" htmlFor={`ca-${r.id}`}>Cash difference (₦)</label><input id={`ca-${r.id}`} name="cashNaira" inputMode="decimal" className="input !min-h-9 !w-36" /></div>}
                {!def.extra || def.extra !== "task" ? <div><label className="label" htmlFor={`no-${r.id}`}>Note</label><input id={`no-${r.id}`} name="note" className="input !min-h-9" /></div> : null}
                <button className="btn-primary !min-h-9">Update</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
