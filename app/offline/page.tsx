import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-navy px-6 text-center text-white">
      <div className="max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="FAGDAN" width={180} height={140} className="mx-auto mb-8 h-auto w-44 rounded-2xl bg-white p-3" />
        <h1 className="font-display text-3xl font-bold">You are currently offline.</h1>
        <p className="mt-3 text-white/75">
          Live inventory, prices and payments need a connection, so we cannot show them right now. Please check your network and try again.
        </p>
        <Link href="/" className="btn-gold mt-8">Try again</Link>
      </div>
    </main>
  );
}
