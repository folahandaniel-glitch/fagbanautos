import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ROLES, roleKeys } from "@/lib/rbac/permissions";
import { createStaff, updateStaff } from "@/app/actions/admin-users";
import { PageHeader, Notice, Pill, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Staff and roles", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; role?: string }> }) {
  const me = await requireStaffPage("users:view");
  const sp = await searchParams;
  const canManage = me.permissions.has("users:manage_admins");
  const users = await db.user.findMany({ where: { kind: "STAFF" }, include: { role: true }, orderBy: { createdAt: "asc" } });
  const otp = (await cookies()).get("fagdan_otp")?.value;
  const [otpEmail, otpPw] = otp ? otp.split("|") : [];
  const staffRoles = ROLES.filter((r) => r.key !== "CUSTOMER");
  const viewRole = staffRoles.find((r) => r.key === sp.role);
  return (
    <>
      <PageHeader title="Staff and roles" sub="Ten responsibility-based roles. The Super Admin controls them all. Permissions are enforced by the server." />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      {otpEmail && otpPw && <div role="alert" className="mb-4 rounded-xl border-2 border-accent bg-accent/10 p-4 text-sm"><p className="font-bold text-navy">One-time password for {otpEmail}</p><p className="mt-1 font-mono text-lg tracking-wide">{otpPw}</p><p className="mt-1 text-xs text-muted">Shown once. Share it securely; the user must change it at first sign-in.</p></div>}
      <Table head={["Name", "Email", "Role", "Status", "2FA", "Last sign-in", ""]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="td font-medium">{u.name}</td><td className="td text-muted">{u.email}</td>
            <td className="td">{canManage && u.role?.key !== "SUPER_ADMIN" ? (
              <form action={updateStaff} className="flex gap-1.5"><input type="hidden" name="id" value={u.id} /><input type="hidden" name="intent" value="role" /><select name="roleKey" defaultValue={u.role?.key} className="input !min-h-9 !py-1 text-xs" aria-label={`Role for ${u.name}`}>{staffRoles.filter((r) => r.key !== "SUPER_ADMIN").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select><button className="btn-ghost !min-h-9 !px-3 text-xs">Set</button></form>
            ) : <Pill tone="gold">{u.role?.name}</Pill>}</td>
            <td className="td"><Pill tone={u.status === "ACTIVE" ? "ok" : "danger"}>{u.status}</Pill>{u.mustChangePassword && <span className="ml-1"><Pill tone="warn">one-time pw</Pill></span>}</td>
            <td className="td">{u.totpEnabled ? <Pill tone="ok">On</Pill> : <Pill tone="warn">Off</Pill>}</td>
            <td className="td text-xs text-muted">{u.lastLoginAt?.toLocaleString("en-NG") ?? "never"}</td>
            <td className="td">{canManage && u.role?.key !== "SUPER_ADMIN" && (
              <form action={updateStaff} className="flex flex-wrap gap-1.5"><input type="hidden" name="id" value={u.id} />
                <button name="intent" value={u.status === "ACTIVE" ? "suspend" : "activate"} className="btn-ghost !min-h-8 !px-2 text-xs">{u.status === "ACTIVE" ? "Suspend" : "Activate"}</button>
                <button name="intent" value="reset" className="btn-ghost !min-h-8 !px-2 text-xs">Reset password</button>
                {u.totpEnabled && <button name="intent" value="reset2fa" className="btn-ghost !min-h-8 !px-2 text-xs">Reset 2FA</button>}</form>)}</td>
          </tr>
        ))}
      </Table>
      {canManage && (
        <form action={createStaff} className="card mt-6 grid gap-3 p-5 sm:grid-cols-4">
          <h2 className="font-display text-lg font-bold text-navy sm:col-span-4">Add a staff member</h2>
          <div><label className="label" htmlFor="n">Name</label><input id="n" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="e">Email</label><input id="e" name="email" type="email" required className="input" /></div>
          <div><label className="label" htmlFor="r">Role</label><select id="r" name="roleKey" className="input">{staffRoles.filter((r) => r.key !== "SUPER_ADMIN").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></div>
          <div className="flex items-end"><button className="btn-primary w-full">Create</button></div>
        </form>
      )}
      <section className="mt-8"><h2 className="font-display text-lg font-bold text-navy">What each role can do</h2>
        <div className="mt-3 flex flex-wrap gap-2">{staffRoles.map((r) => <a key={r.key} href={`?role=${r.key}`} className={`chip ${sp.role === r.key ? "!bg-brand !text-white" : ""}`}>{r.name}</a>)}</div>
        {viewRole && <div className="card mt-3 p-4"><p className="text-sm text-muted">{viewRole.description}</p><p className="mt-2 flex flex-wrap gap-1.5">{roleKeys(viewRole.key).slice(0, viewRole.key === "SUPER_ADMIN" ? 0 : 80).map((k) => <code key={k} className="rounded bg-canvas px-1.5 py-0.5 text-[11px]">{k}</code>)}{viewRole.key === "SUPER_ADMIN" && <span className="text-sm">Unrestricted (all {roleKeys("SUPER_ADMIN").length} permissions), including all financial authority.</span>}</p></div>}
      </section>
    </>
  );
}
