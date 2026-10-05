"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePermission, AuthError } from "@/lib/auth/guard";
import { WORKFLOWS } from "@/lib/workflows";
import { nairaToKobo } from "@/lib/money";

function go(path: string, kind: "notice" | "error", msg: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}
const str = (v: FormDataEntryValue | null) => (v == null ? "" : String(v).trim());

async function notifyCustomer(customerId: string, title: string, body: string) {
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { userId: true } });
  if (c?.userId) await db.notification.create({ data: { userId: c.userId, event: "status.update", title, body } });
}

export async function updateWorkflow(formData: FormData) {
  const kind = str(formData.get("kind"));
  const def = WORKFLOWS[kind];
  const path = `/admin/workflows/${kind}`;
  if (!def) redirect("/admin");
  let user;
  try { user = await requirePermission(def.edit); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}?error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
  const id = str(formData.get("id"));
  const status = str(formData.get("status"));
  if (!def.statuses.includes(status)) go(path, "error", "Invalid status.");
  const note = str(formData.get("note"));
  const label = status.replace(/_/g, " ").toLowerCase();

  if (kind === "leads") {
    const owner = str(formData.get("ownerId")) || null;
    const next = str(formData.get("nextFollowUpAt"));
    const before = await db.lead.findUniqueOrThrow({ where: { id } });
    await db.lead.update({ where: { id }, data: { stage: status, priority: str(formData.get("priority")) || before.priority, ownerId: owner, nextAction: str(formData.get("nextAction")) || before.nextAction, nextFollowUpAt: next ? new Date(next) : before.nextFollowUpAt } });
    if (before.stage !== status || note) await db.leadActivity.create({ data: { leadId: id, note: note || `Stage changed to ${status}`, actorId: user.id } });
    await audit({ actorId: user.id, action: "lead.update", targetType: "Lead", targetId: id, before: { stage: before.stage }, after: { stage: status } });
  } else if (kind === "tasks") {
    const before = await db.task.findUniqueOrThrow({ where: { id } });
    await db.task.update({ where: { id }, data: { status, assigneeId: str(formData.get("ownerId")) || before.assigneeId } });
    await audit({ actorId: user.id, action: "task.update", targetType: "Task", targetId: id, before: { status: before.status }, after: { status } });
  } else if (kind === "bookings") {
    const b = await db.serviceBooking.update({ where: { id }, data: { status }, include: { service: true } });
    await notifyCustomer(b.customerId, "Service booking update", `Your ${b.service.name} booking is now ${label}.`);
    await audit({ actorId: user.id, action: "booking.update", targetType: "ServiceBooking", targetId: id, after: { status } });
  } else if (kind === "imports") {
    const c = await db.importCase.update({ where: { id }, data: { status } });
    await db.importCaseEvent.create({ data: { caseId: id, status, note: note || undefined, actorId: user.id } });
    await notifyCustomer(c.customerId, `Import update ${c.caseNumber}`, `Your import case is now: ${label}.${note ? " " + note : ""}`);
    await audit({ actorId: user.id, action: "import.status", targetType: "ImportCase", targetId: id, after: { status } });
  } else if (kind === "tradeins") {
    const val = str(formData.get("valuationNaira"));
    const t = await db.tradeIn.update({ where: { id }, data: { status, ...(val ? { valuation: BigInt(nairaToKobo(Number(val.replace(/[^\d.]/g, "")))), valuationExpiresAt: new Date(Date.now() + 7 * 86_400_000) } : {}) } });
    await notifyCustomer(t.customerId, "Trade-in update", `Your trade-in is now ${label}.`);
    await audit({ actorId: user.id, action: "tradein.update", targetType: "TradeIn", targetId: id, after: { status, valuation: val || undefined } });
  } else if (kind === "swaps") {
    const cash = str(formData.get("cashNaira"));
    const s = await db.swapRequest.update({ where: { id }, data: { status, ...(cash ? { cashDifference: BigInt(nairaToKobo(Number(cash.replace(/[^\d.-]/g, "")))) } : {}) } });
    await notifyCustomer(s.customerId, "Swap update", `Your swap request is now ${label}.`);
    await audit({ actorId: user.id, action: "swap.update", targetType: "SwapRequest", targetId: id, after: { status, cash: cash || undefined } });
  } else if (kind === "finance") {
    if (["APPROVED", "DECLINED"].includes(status) && !user.permissions.has("finance_applications:approve")) go(path, "error", "You cannot approve or decline applications.");
    const f = await db.financeApplication.update({ where: { id }, data: { status, notes: note || undefined } });
    await notifyCustomer(f.customerId, "Finance application update", `Your finance application is now ${label}.`);
    await audit({ actorId: user.id, action: "finance.update", targetType: "FinanceApplication", targetId: id, after: { status } });
  }
  revalidatePath(path);
  go(path, "notice", "Updated.");
}

export async function createTask(formData: FormData) {
  const path = "/admin/workflows/tasks";
  let user;
  try { user = await requirePermission("tasks:create"); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}?error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
  const title = str(formData.get("title"));
  if (title.length < 3) go(path, "error", "Give the task a title.");
  const deadline = str(formData.get("deadline"));
  const t = await db.task.create({ data: { title, description: str(formData.get("description")) || null, assigneeId: str(formData.get("assigneeId")) || user.id, priority: str(formData.get("priority")) || "MEDIUM", deadline: deadline ? new Date(deadline) : null } });
  await audit({ actorId: user.id, action: "task.create", targetType: "Task", targetId: t.id });
  revalidatePath(path);
  go(path, "notice", "Task created.");
}

export async function createLead(formData: FormData) {
  const path = "/admin/workflows/leads";
  let user;
  try { user = await requirePermission("leads:create"); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : `${path}?error=${encodeURIComponent("You do not have permission to do that.")}`); throw e; }
  const name = str(formData.get("name"));
  if (name.length < 2) go(path, "error", "Enter the lead's name.");
  const l = await db.lead.create({ data: { name, phone: str(formData.get("phone")) || null, email: str(formData.get("email")) || null, source: str(formData.get("source")) || "Manual", interest: str(formData.get("interest")) || null, ownerId: user.id, nextAction: "Make first contact", nextFollowUpAt: new Date(Date.now() + 86_400_000) } });
  await audit({ actorId: user.id, action: "lead.create", targetType: "Lead", targetId: l.id });
  revalidatePath(path);
  go(path, "notice", "Lead added.");
}
