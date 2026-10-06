import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { SETTING_DEFS, settingPermission } from "@/lib/settings-defaults";
import { saveSettings } from "@/app/actions/admin-settings";
import { PageHeader, Notice } from "@/components/admin/ui";

export const metadata: Metadata = { title: "System settings", robots: { index: false } };
export const dynamic = "force-dynamic";

const GROUPS: [string, string][] = [["homepage", "Homepage text"], ["pagetext", "Page text"], ["general", "General"], ["branding", "Branding"], ["currency", "Currency"], ["vat", "VAT"], ["installment", "Installment"], ["payments", "Payments"], ["inventory", "Inventory"], ["shipping", "Shipping"], ["notifications", "Notifications"], ["pwa", "PWA"], ["seo", "SEO"], ["social", "Social media"]];
const FINANCIAL = ["vat", "installment", "payments", "currency", "shipping"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ group?: string; notice?: string; error?: string }> }) {
  const user = await requireStaffPage();
  const fullAccess = user.permissions.has("settings:view");
  if (!fullAccess && !user.permissions.has("content:edit")) await requireStaffPage("settings:view");
  const sp = await searchParams;
  // Content editors only see the wording and SEO groups; financial and system groups need settings access.
  const visible = fullAccess ? GROUPS : GROUPS.filter(([g]) => ["homepage", "pagetext", "seo"].includes(g));
  const group = visible.some(([g]) => g === sp.group) ? sp.group! : visible[0][0];
  const values = await getSettings();
  const defs = Object.entries(SETTING_DEFS).filter(([, d]) => d.group === group);
  return (
    <>
      <PageHeader title="System settings" sub="Everything business-related is editable here. Changes are versioned and audited." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings groups" className="card h-fit p-2">
          <ul>
            {visible.map(([g, l]) => <li key={g}><Link href={`/admin/settings?group=${g}`} aria-current={g === group ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm font-medium ${g === group ? "bg-brand text-white" : "hover:bg-brand-50"}`}>{l}</Link></li>)}
            {user.permissions.has("settings:paystack") && <li><Link href="/admin/settings/paystack" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50">Paystack</Link></li>}
            {user.permissions.has("settings:bank") && <li><Link href="/admin/settings/banks" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50">Bank accounts</Link></li>}
            <li><Link href="/admin/divisions" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50">Divisions</Link></li>
          </ul>
        </nav>
        <form action={saveSettings} className="card space-y-4 p-5">
          <input type="hidden" name="group" value={group} />
          <h2 className="font-display text-lg font-bold capitalize text-navy">{visible.find(([g]) => g === group)?.[1]}</h2>
          {defs.length === 0 && <p className="text-sm text-muted">No settings in this group.</p>}
          {defs.map(([key, d]) => {
            const val = values[key];
            const editable = user.permissions.has(settingPermission(key));
            const id = `s-${key}`;
            return (
              <div key={key}>
                <label className="label" htmlFor={id}>{d.label}</label>
                {d.type === "boolean" ? (
                  <><input type="hidden" name={`s:${key}`} value="false" /><label className="flex min-h-11 items-center gap-2 text-sm"><input id={id} type="checkbox" name={`s:${key}`} value="true" defaultChecked={val === true} disabled={!editable} className="h-4 w-4" /> Enabled</label></>
                ) : d.type === "select" ? (
                  <select id={id} name={`s:${key}`} defaultValue={String(val)} disabled={!editable} className="input">{d.options!.map((o) => <option key={o}>{o}</option>)}</select>
                ) : d.type === "textarea" ? (
                  <textarea id={id} name={`s:${key}`} defaultValue={String(val ?? "")} disabled={!editable} className="input min-h-20" />
                ) : d.type === "color" ? (
                  <input id={id} type="color" name={`s:${key}`} defaultValue={String(val)} disabled={!editable} className="h-11 w-24 rounded-lg border border-line" />
                ) : (
                  <input id={id} name={`s:${key}`} type={d.type === "number" ? "number" : "text"} step="any" defaultValue={String(val ?? "")} disabled={!editable} className="input" />
                )}
                {d.help && <p className="mt-1 text-xs text-muted">{d.help}</p>}
                {!editable && <p className="mt-1 text-xs text-muted">Read-only for your role.</p>}
              </div>
            );
          })}
          {defs.length > 0 && (
            <>
              {FINANCIAL.includes(group) && <div><label className="label" htmlFor="reason">Reason for change (required, recorded in the audit log)</label><input id="reason" name="reason" className="input" /></div>}
              <button className="btn-primary">Save changes</button>
            </>
          )}
        </form>
      </div>
    </>
  );
}
