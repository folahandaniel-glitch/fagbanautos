import { Prisma, type ProductType } from "@prisma/client";
import { db } from "./db";

export const PAGE_SIZE = 12;

export interface VehicleFilters {
  q?: string; make?: string; body?: string; condition?: string; origin?: string; fuel?: string; transmission?: string;
  yearFrom?: number; yearTo?: number; minPrice?: number; maxPrice?: number; installment?: boolean; sort?: string; page?: number;
}

const toInt = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export function parseVehicleFilters(sp: Record<string, string | string[] | undefined>): VehicleFilters {
  const g = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) || undefined;
  return {
    q: g("q"), make: g("make"), body: g("body"), condition: g("condition"), origin: g("origin"), fuel: g("fuel"), transmission: g("transmission"),
    yearFrom: toInt(g("yearFrom")), yearTo: toInt(g("yearTo")), minPrice: toInt(g("minPrice")), maxPrice: toInt(g("maxPrice")),
    installment: g("installment") === "1", sort: g("sort"), page: toInt(g("page")) ?? 1,
  };
}

export async function listVehicles(f: VehicleFilters) {
  const and: Prisma.ProductWhereInput[] = [{ type: "VEHICLE", status: "ACTIVE" }];
  if (f.q) {
    for (const term of f.q.split(/\s+/).filter(Boolean).slice(0, 5)) {
      and.push({ OR: [{ name: { contains: term, mode: "insensitive" } }, { vehicle: { makeName: { contains: term, mode: "insensitive" } } }, { vehicle: { modelName: { contains: term, mode: "insensitive" } } }, { description: { contains: term, mode: "insensitive" } }] });
    }
  }
  const vehicle: Prisma.VehicleWhereInput = {};
  if (f.make) vehicle.makeName = { equals: f.make, mode: "insensitive" };
  if (f.body) vehicle.bodyType = { equals: f.body, mode: "insensitive" };
  if (f.fuel) vehicle.fuelType = { equals: f.fuel, mode: "insensitive" };
  if (f.transmission) vehicle.transmission = { equals: f.transmission, mode: "insensitive" };
  if (f.yearFrom || f.yearTo) vehicle.year = { gte: f.yearFrom, lte: f.yearTo };
  if (f.installment) vehicle.installmentAvailable = true;
  if (Object.keys(vehicle).length) and.push({ vehicle });
  if (f.condition) and.push({ condition: f.condition as never });
  if (f.origin) and.push({ origin: { equals: f.origin, mode: "insensitive" } });
  if (f.minPrice || f.maxPrice) and.push({ price: { gte: f.minPrice ? BigInt(f.minPrice) * 100n : undefined, lte: f.maxPrice ? BigInt(f.maxPrice) * 100n : undefined } });
  const where: Prisma.ProductWhereInput = { AND: and };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    f.sort === "price_asc" ? [{ price: "asc" }] : f.sort === "price_desc" ? [{ price: "desc" }] : f.sort === "year_desc" ? [{ vehicle: { year: "desc" } }] : [{ featured: "desc" }, { createdAt: "desc" }];
  const page = Math.max(1, f.page ?? 1);
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, vehicle: true } }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function vehicleFacets() {
  const [makes, bodies, origins, fuels] = await Promise.all([
    db.vehicle.groupBy({ by: ["makeName"], where: { product: { status: "ACTIVE" } }, _count: true, orderBy: { makeName: "asc" } }),
    db.vehicle.groupBy({ by: ["bodyType"], where: { product: { status: "ACTIVE" } }, _count: true, orderBy: { bodyType: "asc" } }),
    db.product.groupBy({ by: ["origin"], where: { type: "VEHICLE", status: "ACTIVE" }, _count: true, orderBy: { origin: "asc" } }),
    db.vehicle.groupBy({ by: ["fuelType"], where: { product: { status: "ACTIVE" } }, _count: true, orderBy: { fuelType: "asc" } }),
  ]);
  return { makes, bodies, origins: origins.filter((o) => o.origin), fuels };
}

// ───────── Parts / accessories / technology ─────────
export interface ShopFilters {
  types: ProductType[]; q?: string; category?: string; brand?: string; grade?: string;
  fitMake?: string; fitModel?: string; fitYear?: number; sort?: string; page?: number; divisionId?: string;
}

/** Fitment: rows that match make/model/year (null model or year bounds = any). */
export function fitmentWhere(make: string, model?: string, year?: number): Prisma.CompatibilityWhereInput {
  return {
    makeName: { equals: make, mode: "insensitive" },
    AND: [
      model ? { OR: [{ modelName: null }, { modelName: { equals: model, mode: "insensitive" } }] } : {},
      year ? { AND: [{ OR: [{ yearFrom: null }, { yearFrom: { lte: year } }] }, { OR: [{ yearTo: null }, { yearTo: { gte: year } }] }] } : {},
    ],
  };
}

export async function listShop(f: ShopFilters) {
  const and: Prisma.ProductWhereInput[] = [{ type: { in: f.types }, status: "ACTIVE" }];
  if (f.divisionId) and.push({ divisionId: f.divisionId });
  if (f.q) for (const term of f.q.split(/\s+/).filter(Boolean).slice(0, 6)) and.push({ OR: [{ name: { contains: term, mode: "insensitive" } }, { brand: { name: { contains: term, mode: "insensitive" } } }, { category: { name: { contains: term, mode: "insensitive" } } }, { partNumber: { contains: term, mode: "insensitive" } }] });
  if (f.category) and.push({ OR: [{ category: { slug: f.category } }, { category: { parent: { slug: f.category } } }] });
  if (f.brand) and.push({ brand: { slug: f.brand } });
  if (f.grade === "OEM" || f.grade === "AFTERMARKET") and.push({ partGrade: f.grade });
  let fitting = false;
  if (f.fitMake) {
    fitting = true;
    // compatible rows first; universal items (no compat rows) are included but flagged as "confirm fit"
    and.push({ OR: [{ compat: { some: fitmentWhere(f.fitMake, f.fitModel, f.fitYear) } }, { compat: { none: {} } }] });
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = f.sort === "price_asc" ? [{ price: "asc" }] : f.sort === "price_desc" ? [{ price: "desc" }] : [{ featured: "desc" }, { name: "asc" }];
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.ProductWhereInput = { AND: and };
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, compat: { select: { id: true } } } }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), fitting };
}

/** Parse free text like "brake pad for 2021 Toyota Camry" into fitment + keywords. */
export async function parseSmartQuery(raw: string) {
  const text = raw.trim();
  const yearMatch = text.match(/\b(19[89]\d|20[0-4]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  const lower = text.toLowerCase();
  const makes = await db.brand.findMany({ where: { isVehicleMake: true }, select: { name: true } });
  const make = makes.map((m) => m.name).sort((a, b) => b.length - a.length).find((m) => lower.includes(m.toLowerCase()));
  let model: string | undefined;
  if (make) {
    const models = await db.vehicleModel.findMany({ where: { brand: { name: make } }, select: { name: true } });
    model = models.map((m) => m.name).sort((a, b) => b.length - a.length).find((m) => lower.includes(m.toLowerCase()));
  }
  let keywords = text;
  for (const rm of [yearMatch?.[1], make, model, "for"]) if (rm) keywords = keywords.replace(new RegExp(`\\b${rm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
  keywords = keywords.replace(/\s+/g, " ").trim();
  return { year, make, model, keywords };
}

/** Accessories and services recommended for a specific vehicle. Compatible items first, then best-selling universal items. */
export async function accessoriesForVehicle(make: string, model: string, year: number, take = 8) {
  const fit = await db.product.findMany({
    where: { type: { in: ["ACCESSORY", "TECHNOLOGY"] }, status: "ACTIVE", compat: { some: fitmentWhere(make, model, year) } },
    include: { images: { take: 1 }, compat: { select: { id: true } } }, take,
    orderBy: { featured: "desc" },
  });
  const have = new Set(fit.map((p) => p.id));
  const wanted = ["Phone Holders", "Car Chargers", "Dashcams", "Sunshades", "Air Fresheners", "Cleaning Kits", "Floor Mats", "Boot Mats"];
  const universal = await db.product.findMany({
    where: { type: { in: ["ACCESSORY", "TECHNOLOGY"] }, status: "ACTIVE", compat: { none: {} }, id: { notIn: [...have] }, category: { name: { in: wanted } } },
    include: { images: { take: 1 }, compat: { select: { id: true } } }, take: Math.max(0, take - fit.length),
  });
  return { fit, universal };
}
