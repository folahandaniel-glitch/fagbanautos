import type { Metadata } from "next";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { changePassword } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Change password", robots: { index: false, follow: false } };
const ERRORS: Record<string, string> = { current: "Your current password is incorrect.", match: "The new passwords do not match.", same: "Choose a password different from the current one." };

export default async function ChangePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <form action={changePassword} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="font-display text-xl font-extrabold text-navy">{user.mustChangePassword ? "Set a new password" : "Change password"}</h1>
        {user.mustChangePassword && <p className="text-sm text-muted">Your account uses a one-time password. Choose your own to continue.</p>}
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{ERRORS[sp.error] ?? sp.error}</p>}
        <div><label className="label" htmlFor="current">Current password</label><PasswordInput id="current" name="current" required autoComplete="current-password" className="input" /></div>
        <div><label className="label" htmlFor="next">New password</label><PasswordInput id="next" name="next" required minLength={10} autoComplete="new-password" className="input" /></div>
        <div><label className="label" htmlFor="confirm">Confirm new password</label><PasswordInput id="confirm" name="confirm" required minLength={10} autoComplete="new-password" className="input" /></div>
        <button className="btn-primary w-full">Save password</button>
      </form>
    </main>
  );
}
