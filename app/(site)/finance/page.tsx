import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Vehicle Finance", description: "Outright purchase, FAGDAN installment plans and finance applications.", alternates: { canonical: "/finance" } };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const s = await getSettings("installment.");
  const c = await getContent();
  const uplift = Number(s["installment.upliftBps"]) / 100;
  const threshold = Number(s["installment.releaseThresholdBps"]) / 100;
  const minDep = Number(s["installment.minDepositBps"]) / 100;
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-3xl font-extrabold text-navy">{c.t("pages.finance.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{c.t("pages.finance.intro")}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="card p-6"><h2 className="font-display text-lg font-bold text-navy">1. Outright purchase</h2><p className="mt-2 text-sm text-muted">Pay the full price (plus VAT) by card, bank transfer or Paystack and take delivery once payment is verified.</p></div>
        <div className="card border-accent/50 p-6"><h2 className="font-display text-lg font-bold text-navy">2. FAGDAN installment</h2><p className="mt-2 text-sm text-muted">On eligible vehicles, the installment price is the outright price plus {uplift}%. Pay a deposit (minimum {minDep}%) and the balance in installments. The vehicle is released once at least <strong>{threshold}%</strong> of the installment total has been paid and verified.</p></div>
        <div className="card p-6"><h2 className="font-display text-lg font-bold text-navy">3. Finance application</h2><p className="mt-2 text-sm text-muted">Apply for financing and our team will guide you. Where a third-party lender is used, we name the provider clearly.</p></div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/cars?installment=1" className="btn-primary">Browse installment cars</Link><Link href="/finance/apply" className="btn-gold">Apply for finance</Link></div>
      <p className="mt-8 max-w-3xl rounded-xl bg-brand-50 p-4 text-sm text-ink"><strong>Important:</strong> {c.t("pages.finance.note")} <Link href="/legal/installment-terms" className="font-semibold text-brand underline">Read the installment terms</Link>.</p>
    </div>
  );
}
