import type { Metadata } from "next";
import Link from "next/link";
import { registerCustomer } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };
const ERRORS: Record<string, string> = { invalid: "Please check your details and try again.", exists: "An account with this email already exists.", rate: "Too many attempts. Please wait a few minutes.", consent: "You must accept the Terms and Privacy Policy to continue." };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-12">
      <form action={registerCustomer} className="card w-full max-w-md space-y-4 p-6">
        <h1 className="font-display text-2xl font-extrabold text-navy">Create your account</h1>
        {sp.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{ERRORS[sp.error] ?? sp.error}</p>}
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" required autoComplete="name" className="input" /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" required autoComplete="tel" className="input" placeholder="0806 000 0000" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="input" aria-describedby="pw-help" /><p id="pw-help" className="mt-1 text-xs text-muted">At least 10 characters with upper case, lower case and a number.</p></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1 h-4 w-4" /> <span>I accept the <Link href="/legal/terms" className="text-brand underline">Terms</Link> and <Link href="/legal/privacy" className="text-brand underline">Privacy Policy</Link>.</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="marketing" className="mt-1 h-4 w-4" /> <span>Send me offers and updates (optional).</span></label>
        <button className="btn-primary w-full">Create account</button>
        <p className="text-center text-sm text-muted">Already registered? <Link href="/account/login" className="font-semibold text-brand underline">Sign in</Link></p>
      </form>
    </div>
  );
}
