"use client";

import Link from "next/link";

/** Generic error page. Never shows internal details; the digest lets support find the server log entry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <div className="card max-w-md p-8">
        <h1 className="font-display text-2xl font-extrabold text-navy">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted">We hit a problem loading this page. Please try again. If it keeps happening, contact us on WhatsApp.</p>
        {error.digest && <p className="mt-3 text-xs text-muted">Reference: <span className="font-mono">{error.digest}</span></p>}
        <div className="mt-6 flex justify-center gap-3"><button onClick={reset} className="btn-primary">Try again</button><Link href="/" className="btn-ghost">Home</Link></div>
      </div>
    </main>
  );
}
