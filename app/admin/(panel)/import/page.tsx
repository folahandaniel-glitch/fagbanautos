import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import type { ParsedRow } from "@/lib/services/excel";
import { previewImport, runImport } from "@/app/actions/admin-import";
import { PageHeader, Notice, Table, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Excel import", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ job?: string; error?: string; done?: string; ok?: string; failed?: string }> }) {
  const user = await requireStaffPage();
  if (!["inventory:import", "vehicles:import", "products:import"].some((p) => user.permissions.has(p))) await requireStaffPage("inventory:import");
  const sp = await searchParams;
  const job = sp.job ? await db.importJob.findUnique({ where: { id: sp.job } }) : null;
  const rows = job ? ((job.errors as unknown as { rows: ParsedRow[] })?.rows ?? []) : [];
  const valid = rows.filter((r) => !r.errors.length).length;
  return (
    <>
      <PageHeader title="Excel inventory import" sub="Download the template, fill it in, upload it, review the preview, then import." actions={<Link href="/admin/export/template" prefetch={false} className="btn-ghost">Download template</Link>} />
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      {sp.done && <Notice kind="ok">Import finished: {sp.ok} succeeded, {sp.failed} failed. New items are saved as DRAFT unless the sheet says otherwise.</Notice>}
      <form action={previewImport} encType="multipart/form-data" className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div><label className="label" htmlFor="file">Upload filled template (.xlsx, max 8 MB)</label><input id="file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="input !py-2" /></div>
        <button className="btn-primary">Validate and preview</button>
      </form>
      {job && (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3"><h2 className="font-display text-lg font-bold text-navy">Preview</h2><Pill tone="ok">{valid} ready</Pill><Pill tone={rows.length - valid ? "danger" : "info"}>{rows.length - valid} with errors</Pill><Pill>{job.status}</Pill></div>
          {job.status === "VALIDATED" && (
            <form action={runImport} className="mb-4 flex flex-wrap items-center gap-3"><input type="hidden" name="jobId" value={job.id} />
              <button className="btn-primary" disabled={valid === 0}>Import {valid} valid row{valid === 1 ? "" : "s"}</button>
              {rows.length - valid > 0 && <p className="text-sm text-muted">Rows with errors are skipped. Correct them in your sheet and upload again.</p>}</form>
          )}
          <Table head={["Row", "SKU", "Type", "Name", "Price (₦)", "Result"]}>
            {rows.slice(0, 300).map((r) => (
              <tr key={r.rowNumber} className="align-top">
                <td className="td">{r.rowNumber}</td><td className="td font-mono text-xs">{r.data.SKU}</td><td className="td">{r.data["Product Type"]}</td><td className="td">{r.data.Name || `${r.data.Year ?? ""} ${r.data.Make ?? ""} ${r.data.Model ?? ""}`}</td><td className="td">{r.data.Price}</td>
                <td className="td text-xs">{r.errors.length ? <ul className="space-y-0.5 text-danger">{r.errors.map((e) => <li key={e}>• {e}</li>)}</ul> : <Pill tone="ok">OK</Pill>}{r.warnings.map((w) => <p key={w} className="mt-1 text-warn">⚠ {w}</p>)}</td>
              </tr>
            ))}
          </Table>
          {rows.length > 300 && <p className="mt-2 text-sm text-muted">Showing the first 300 rows. All rows will be processed.</p>}
        </section>
      )}
      <p className="mt-6 text-sm text-muted">Image URLs must be https and end in .jpg, .png or .webp. Items without images receive a branded placeholder and are flagged &quot;needs image&quot; in <Link href="/admin/inventory" className="text-brand underline">Inventory</Link>.</p>
    </>
  );
}
