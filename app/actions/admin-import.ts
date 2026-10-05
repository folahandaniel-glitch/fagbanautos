"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAnyPermission, AuthError } from "@/lib/auth/guard";
import { parseWorkbook, importRows, type ParsedRow } from "@/lib/services/excel";
import type { Prisma } from "@prisma/client";

const MAX_BYTES = 8 * 1024 * 1024;

async function need() {
  try { return await requireAnyPermission("inventory:import", "vehicles:import", "products:import"); }
  catch (e) { if (e instanceof AuthError) redirect(e.status === 401 ? "/admin/login" : "/admin?denied=1"); throw e; }
}

/** Step 1: upload + validate. Rows are parked in an ImportJob so the preview and the import act on the same data. */
export async function previewImport(formData: FormData) {
  const user = await need();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/admin/import?error=" + encodeURIComponent("Choose an .xlsx file."));
  if (!file.name.toLowerCase().endsWith(".xlsx")) redirect("/admin/import?error=" + encodeURIComponent("Only .xlsx files are accepted."));
  if (file.size > MAX_BYTES) redirect("/admin/import?error=" + encodeURIComponent("File is too large (max 8 MB)."));
  const { rows, fatal } = await parseWorkbook(Buffer.from(await file.arrayBuffer()));
  if (fatal) redirect("/admin/import?error=" + encodeURIComponent(fatal));
  const bad = rows.filter((r) => r.errors.length).length;
  const job = await db.importJob.create({ data: { kind: "inventory", status: "VALIDATED", total: rows.length, failed: bad, succeeded: 0, errors: { rows } as unknown as Prisma.InputJsonValue, actorId: user.id } });
  redirect(`/admin/import?job=${job.id}`);
}

/** Step 2: import every valid row (rows with errors are skipped and reported). */
export async function runImport(formData: FormData) {
  const user = await need();
  const jobId = String(formData.get("jobId"));
  const job = await db.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "VALIDATED") redirect("/admin/import?error=" + encodeURIComponent("This preview has expired or was already imported."));
  const rows = ((job.errors as unknown as { rows: ParsedRow[] }).rows ?? []);
  const { ok, failures } = await importRows(rows, user.id, job.id);
  redirect(`/admin/import?job=${job.id}&done=1&ok=${ok}&failed=${failures.length}`);
}
