import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { getPaystackConfig } from "@/lib/services/paystack";
import { savePaystack, clearPaystackSecret } from "@/app/actions/admin-settings";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Paystack settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaystackSettings({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  await requireStaffPage("settings:paystack");
  const sp = await searchParams;
  const [row, cfg] = await Promise.all([db.paymentGateway.findUnique({ where: { key: "paystack" } }), getPaystackConfig()]);
  const base = process.env.APPLICATION_URL ?? "http://localhost:3000";
  return (
    <>
      <PageHeader title="Paystack" sub="Payment gateway credentials. Secret keys are encrypted, write-only, and never shown after saving." actions={<Link href="/admin/settings?group=payments" className="btn-ghost">Back to payments</Link>} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <div className="mb-4 flex flex-wrap gap-2"><Pill tone={cfg.enabled ? "ok" : "warn"}>{cfg.enabled ? "Enabled" : "Disabled"}</Pill><Pill>{(row?.mode ?? "test").toUpperCase()} mode</Pill><Pill tone={cfg.secretKey ? "ok" : "danger"}>{cfg.secretKey ? `Secret key set (${cfg.source})` : "No secret key"}</Pill></div>
      <form action={savePaystack} className="card max-w-2xl space-y-4 p-5">
        <div><label className="label" htmlFor="publicKey">Public key</label><input id="publicKey" name="publicKey" defaultValue={row?.publicKey ?? ""} className="input font-mono" placeholder="pk_test_…" autoComplete="off" /></div>
        <div><label className="label" htmlFor="secretKey">Secret key {cfg.secretKey && <span className="font-normal text-muted">(saved. Enter a new one to replace it)</span>}</label><input id="secretKey" name="secretKey" type="password" className="input font-mono" placeholder={cfg.secretKey ? "••••••••••••••••" : "sk_test_…"} autoComplete="new-password" /><p className="mt-1 text-xs text-muted">{process.env.PAYSTACK_SECRET_KEY ? "An environment variable is set and takes precedence over this field." : "Stored encrypted (AES-256-GCM). Never sent to the browser."}</p></div>
        <fieldset className="flex gap-4"><legend className="label">Mode</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" value="test" defaultChecked={(row?.mode ?? "test") === "test"} /> Test</label>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="mode" value="live" defaultChecked={row?.mode === "live"} /> Live</label></fieldset>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="enabled" defaultChecked={row?.enabled} className="h-4 w-4" /> Enable Paystack payments</label>
        <p className="rounded-lg bg-brand-50 p-3 text-xs">Currency: NGN. Paystack signs webhooks with your secret key (HMAC-SHA512), so no separate webhook secret is needed. Set your webhook URL in the Paystack dashboard to: <code className="font-mono font-semibold">{base}/api/paystack/webhook</code></p>
        <div className="flex flex-wrap gap-2"><button name="action" value="save" className="btn-primary">Save</button><button name="action" value="test" className="btn-ghost">Save and test key</button></div>
      </form>
      {cfg.source === "database" && <form action={clearPaystackSecret} className="mt-4"><button className="btn-danger">Remove stored secret and disable Paystack</button></form>}
    </>
  );
}
