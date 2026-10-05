import Image from "next/image";
import { formatNaira } from "@/lib/money";

/** Renders generated placeholders as plain <img> (SVG) and real photos through next/image. */
export function SmartImage({ src, alt, className = "", sizes = "(max-width: 768px) 100vw, 33vw", priority = false }: { src: string; alt: string; className?: string; sizes?: string; priority?: boolean }) {
  if (src.startsWith("/api/placeholder")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} loading={priority ? "eager" : "lazy"} decoding="async" />;
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />;
}

export function Price({ price, discount = 0, className = "" }: { price: number; discount?: number; className?: string }) {
  const eff = price - discount;
  return (
    <span className={className}>
      <span className="font-display font-bold text-navy">{formatNaira(eff)}</span>
      {discount > 0 && <span className="ml-2 text-xs text-muted line-through">{formatNaira(price)}</span>}
    </span>
  );
}

export function DemoTag() {
  return <span className="badge-gold">Demo</span>;
}
