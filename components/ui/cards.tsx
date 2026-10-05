import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { SmartImage, Price, DemoTag } from "./media";

type VehicleProduct = Prisma.ProductGetPayload<{ include: { images: true; vehicle: true } }>;
type AnyProduct = Prisma.ProductGetPayload<{ include: { images: true } }>;

const COND: Record<string, string> = {
  BRAND_NEW: "Brand New", FOREIGN_USED: "Foreign Used", NIGERIAN_USED: "Nigerian Used", CERTIFIED_USED: "Certified Used", NEARLY_NEW: "Nearly New", EXECUTIVE_USED: "Executive Used",
};
export const conditionLabel = (c?: string | null) => (c ? COND[c] ?? c : "");

export function VehicleCard({ p }: { p: VehicleProduct }) {
  const v = p.vehicle;
  const available = p.stockOnHand - p.stockReserved > 0;
  return (
    <Link href={`/cars/${p.slug}`} className="card tilt group block overflow-hidden">
      <div className="relative aspect-[3/2] overflow-hidden bg-brand-50">
        {p.images[0] && <SmartImage src={p.images[0].url} alt={p.images[0].alt ?? p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.condition && <span className="chip bg-white/95">{conditionLabel(p.condition)}</span>}
          {v?.installmentAvailable && <span className="badge-gold bg-white/95">Installment</span>}
        </div>
        {p.isDemo && <div className="absolute bottom-3 left-3"><DemoTag /></div>}
        {!available && <div className="absolute inset-0 grid place-items-center bg-navy/60 text-sm font-bold uppercase tracking-wider text-white">Reserved</div>}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 text-base font-bold text-navy">{p.name}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted">
          {[v?.mileageKm != null ? `${v.mileageKm.toLocaleString("en-NG")} km` : null, v?.transmission, v?.fuelType, p.origin].filter(Boolean).join(" · ")}
        </p>
        <Price price={Number(p.price)} discount={Number(p.discount)} className="mt-3 block text-lg" />
      </div>
    </Link>
  );
}

export function ProductCard({ p, href }: { p: AnyProduct; href: string }) {
  const available = p.stockOnHand - p.stockReserved > 0 || p.allowBackorder;
  return (
    <Link href={href} className="card tilt group block overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-50">
        {p.images[0] && <SmartImage src={p.images[0].url} alt={p.images[0].alt ?? p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.partGrade && <span className="chip bg-white/95">{p.partGrade === "OEM" ? "OEM" : "Aftermarket"}</span>}
        </div>
        {p.isDemo && <div className="absolute bottom-3 left-3"><DemoTag /></div>}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{p.shortDescription?.split(" ")[0] ?? ""}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-10 text-sm font-semibold text-navy">{p.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <Price price={Number(p.price)} discount={Number(p.discount)} />
          <span className={`text-xs font-medium ${available ? "text-ok" : "text-danger"}`}>{available ? "In stock" : "Out of stock"}</span>
        </div>
      </div>
    </Link>
  );
}
