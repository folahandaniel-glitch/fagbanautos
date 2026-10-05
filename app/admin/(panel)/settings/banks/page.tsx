import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { saveBank, deleteBank } from "@/app/actions/admin-settings";
import { PageHeader, Notice, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Bank accounts", robots: { index: false } };
export const dynamic = "force-dynamic";
const BANKS = ["GTBank", "Access Bank", "First Bank", "UBA", "Zenith Bank", "Moniepoint", "Opay", "Kuda", "Wema Bank", "Fidelity Bank", "Union Bank", "Sterling Bank", "Stanbic IBTC", "Polaris Bank", "Other"];

function BankForm({ b }: { b?: { id: string; bankName: string; accountName: string; accountNumber: string; accountType: string; branch: string | null; bankCode: string | null; currency: string; instructions: string | null; isActive: boolean } }) {
  const k = b?.id ?? "new";
  return (
    <form action={saveBank} className="grid gap-3 sm:grid-cols-2">
      {b && <input type="hidden" name="id" value={b.id} />}
      <div><label className="label" htmlFor={`bn-${k}`}>Bank name</label><input id={`bn-${k}`} name="bankName" list="banks" defaultValue={b?.bankName} required className="input" /></div>
      <div><label className="label" htmlFor={`an-${k}`}>Account name</label><input id={`an-${k}`} name="accountName" defaultValue={b?.accountName} required className="input" /></div>
      <div><label className="label" htmlFor={`ac-${k}`}>Account number (10 digits)</label><input id={`ac-${k}`} name="accountNumber" defaultValue={b?.accountNumber} required inputMode="numeric" maxLength={10} className="input font-mono" /></div>
      <div><label className="label" htmlFor={`at-${k}`}>Account type</label><select id={`at-${k}`} name="accountType" defaultValue={b?.accountType ?? "Current"} className="input"><option>Current</option><option>Savings</option><option>Corporate</option></select></div>
      <div><label className="label" htmlFor={`br-${k}`}>Branch</label><input id={`br-${k}`} name="branch" defaultValue={b?.branch ?? ""} className="input" /></div>
      <div><label className="label" htmlFor={`bc-${k}`}>Bank code</label><input id={`bc-${k}`} name="bankCode" defaultValue={b?.bankCode ?? ""} className="input" /></div>
      <div><label className="label" htmlFor={`cu-${k}`}>Currency</label><input id={`cu-${k}`} name="currency" defaultValue={b?.currency ?? "NGN"} className="input" /></div>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium"><input type="checkbox" name="isActive" defaultChecked={b?.isActive} className="h-4 w-4" /> Active (shown to customers)</label>
      <div className="sm:col-span-2"><label className="label" htmlFor={`in-${k}`}>Payment instructions</label><textarea id={`in-${k}`} name="instructions" defaultValue={b?.instructions ?? ""} className="input min-h-16" /></div>
      <div className="sm:col-span-2"><button className="btn-primary">{b ? "Save account" : "Add account"}</button></div>
    </form>
  );
}

export default async function BanksPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  await requireStaffPage("settings:bank");
  const sp = await searchParams;
  const banks = await db.bankAccount.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title="Company bank accounts" sub="Accounts shown to customers paying by bank transfer. Only the Super Admin can change these." actions={<Link href="/admin/settings?group=payments" className="btn-ghost">Back to payments</Link>} />
      {sp.notice && <Notice kind="ok">{sp.notice}</Notice>}
      {sp.error && <Notice kind="error">{sp.error}</Notice>}
      <datalist id="banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
      <div className="space-y-4">
        {banks.map((b) => (
          <section key={b.id} className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-bold text-navy">{b.bankName}</h2><Pill tone={b.isActive ? "ok" : "warn"}>{b.isActive ? "Active" : "Inactive"}</Pill>{b.isPlaceholder && <Pill tone="danger">Placeholder: replace with the real account</Pill>}</div>
            <BankForm b={b} />
            <form action={deleteBank} className="mt-3"><input type="hidden" name="id" value={b.id} /><button className="text-sm font-medium text-danger hover:underline">Delete account</button></form>
          </section>
        ))}
        <section className="card p-5"><h2 className="mb-3 font-display text-lg font-bold text-navy">Add a bank account</h2><BankForm /></section>
      </div>
    </>
  );
}
