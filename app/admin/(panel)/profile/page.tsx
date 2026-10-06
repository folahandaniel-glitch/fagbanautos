import type { Metadata } from "next";
import { changeEmail, changePassword } from "@/app/actions/auth";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { totpUri } from "@/lib/totp";
import { begin2fa, confirm2fa, disable2fa } from "@/app/actions/admin-users";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "My profile", robots: { index: false } };
export const dynamic = "force-dynamic";
const ERRORS: Record<string, string> = { current: "Your current password is incorrect.", match: "The new passwords do not match.", same: "Choose a password different from the current one." };

export default async function Profile({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; setup?: string }> }) {
  const u = await requireStaffPage();
  const sp = await searchParams;
  const row = await db.user.findUniqueOrThrow({ where: { id: u.id } });
  const pending = sp.setup && row.totpSecretEnc && !row.totpEnabled ? decryptSecret(row.totpSecretEnc) : null;
  return (
    <>
      <PageHeader title="My profile" sub={`${u.name} · ${u.email}`} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{ERRORS[sp.error] ?? sp.error}</Notice>}
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <form action={changePassword} className="card space-y-4 p-5" aria-labelledby="pw-h">
          <h2 id="pw-h" className="font-display text-lg font-bold text-navy">Change password</h2>
          <p className="text-sm text-muted">Use at least 10 characters with upper case, lower case and a number. Changing it signs you out on all other devices.</p>
          <input type="hidden" name="returnTo" value="profile" />
          <div><label className="label" htmlFor="cp-current">Current password</label><input id="cp-current" name="current" type="password" required autoComplete="current-password" className="input" /></div>
          <div><label className="label" htmlFor="cp-next">New password</label><input id="cp-next" name="next" type="password" required minLength={10} autoComplete="new-password" className="input" /></div>
          <div><label className="label" htmlFor="cp-confirm">Confirm new password</label><input id="cp-confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" /></div>
          <button className="btn-primary">Change password</button>
        </form>
        <form action={changeEmail} className="card space-y-4 p-5" aria-labelledby="em-h">
          <h2 id="em-h" className="font-display text-lg font-bold text-navy">Sign-in email</h2>
          <p className="text-sm text-muted">Currently <strong className="text-ink">{row.email}</strong>. Enter your password to change it.</p>
          <div><label className="label" htmlFor="ce-email">New email</label><input id="ce-email" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="ce-pw">Password</label><input id="ce-pw" name="password" type="password" required autoComplete="current-password" className="input" /></div>
          <button className="btn-primary">Change email</button>
        </form>
      </div>
      <section className="card mt-6 max-w-xl space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-navy">Two-factor authentication</h2>
        <p className="text-sm text-muted">Protects your account with a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). Strongly recommended for every staff account.</p>
        <p>Status: {row.totpEnabled ? <Pill tone="ok">On</Pill> : <Pill tone="warn">Off</Pill>}</p>
        {!row.totpEnabled && !pending && <form action={begin2fa}><button className="btn-primary">Set up two-factor</button></form>}
        {pending && (
          <div className="space-y-3">
            <p className="text-sm">Add this account in your authenticator app using the secret key below (or paste the link on your phone), then enter the 6-digit code.</p>
            <p className="rounded-lg bg-canvas p-3 font-mono text-lg tracking-widest">{pending}</p>
            <p className="break-all text-xs text-muted">{totpUri(u.email, pending)}</p>
            <form action={confirm2fa} className="flex items-end gap-2"><div><label className="label" htmlFor="code">Code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className="input" /></div><button className="btn-primary">Confirm</button></form>
          </div>
        )}
        {row.totpEnabled && <form action={disable2fa} className="flex items-end gap-2"><div><label className="label" htmlFor="pw">Password</label><input id="pw" name="password" type="password" required autoComplete="current-password" className="input" /></div><button className="btn-ghost">Turn off</button></form>}
      </section>
    </>
  );
}
