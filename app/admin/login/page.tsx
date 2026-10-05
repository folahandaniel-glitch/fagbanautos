import type { Metadata } from "next";
import Image from "next/image";
import { login } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };
const ERRORS: Record<string, string> = { invalid: "Incorrect email or password.", locked: "Account temporarily locked. Try again in 15 minutes.", rate: "Too many attempts. Please wait.", code: "Enter the 6-digit code from your authenticator app." };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-navy px-4">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <Image src="/brand/logo.png" alt="FAGDAN" width={110} height={90} className="mx-auto h-16 w-auto" priority />
        <h1 className="text-center font-display text-xl font-extrabold text-navy">Staff sign in</h1>
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
        <input type="hidden" name="portal" value="admin" />
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" defaultValue={sp.email} className="input" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
        {sp.error === "code" && <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus className="input" /></div>}
        <button className="btn-primary w-full">Sign in</button>
        <p className="text-center text-xs text-muted">Authorised personnel only. Activity is logged.</p>
      </form>
    </main>
  );
}
