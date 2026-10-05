import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };
const COPY: Record<string, string> = {
  "test-drive": "Your test drive request is in. Our team will confirm the time with you shortly.",
  contact: "Thanks for getting in touch. We will reply within one business day.",
  booking: "Your service booking is confirmed. You will find it in your account.",
  import: "We have created your sourcing case and will contact you shortly.",
  finance: "Your finance application has been received. Our team will review it and contact you.",
  "trade-in": "Your trade-in request is received. An appraiser will value your car and contact you.",
  swap: "Your swap request is received. We will value both vehicles and contact you.",
};

export default async function ThankYou({ searchParams }: { searchParams: Promise<{ type?: string; ref?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-12">
      <div className="card max-w-lg p-8 text-center">
        <h1 className="font-display text-2xl font-extrabold text-navy">Thank you</h1>
        <p className="mt-3 text-sm text-muted">{COPY[sp.type ?? ""] ?? "We have received your request."}</p>
        {sp.ref && <p className="mt-3 text-sm">Reference: <strong className="font-mono">{sp.ref.slice(0, 40)}</strong></p>}
        <div className="mt-6 flex justify-center gap-3"><Link href="/account" className="btn-primary">My account</Link><Link href="/" className="btn-ghost">Home</Link></div>
      </div>
    </div>
  );
}
