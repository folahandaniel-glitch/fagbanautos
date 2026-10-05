import type { Metadata } from "next";
import Link from "next/link";
import { login } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
const ERRORS: Record<string, string> = { invalid: "Incorrect email or password.", locked: "Too many attempts. Try again in 15 minutes.", rate: "Too many attempts. Please wait a few minutes.", code: "Enter the 6-digit code from your authenticator app." };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-12">
      <form action={login} className="card w-full max-w-md space-y-4 p-6">
        <h1 className="font-display text-2xl font-extrabold text-navy">Sign in</h1>
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={sp.email} className="input" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
        {sp.error === "code" && <div><label className="label" htmlFor="code">Authenticator code</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" className="input" /></div>}
        <button className="btn-primary w-full">Sign in</button>
        <p className="text-center text-sm text-muted">New to FAGDAN? <Link href="/account/register" className="font-semibold text-brand underline">Create an account</Link></p>
      </form>
    </div>
  );
}
