import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-navy px-6 text-center text-white">
      <div className="max-w-lg">
        <p className="font-display text-7xl font-extrabold text-accent">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Looks like this road leads nowhere.</h1>
        <p className="mt-3 text-white/70">The page you are looking for has moved, sold out, or never existed. Let&apos;s get you back on track.</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/" className="btn-gold">Return Home</Link><Link href="/cars" className="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">Explore Vehicles</Link></div>
      </div>
    </main>
  );
}
