import Image from "next/image";

/** Short branded loader: logo with a subtle road-line sweep. Kept intentionally brief. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-[50vh] place-items-center">
      <div className="text-center">
        <Image src="/brand/logo.png" alt="" width={96} height={78} priority className="mx-auto h-16 w-auto animate-pulse" />
        <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-brand-50"><div className="drift h-full w-1/2 rounded-full bg-accent" /></div>
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
