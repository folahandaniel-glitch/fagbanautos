import { db } from "@/lib/db";

/** Shown on the About page until the admin creates real cards in Admin > About and team. Wording is a starting point, not a claim of fact. */
export const DEFAULT_TEAM = [
  { name: "Banjo Folahan Daniel", role: "Founder", bio: "Founder of FAGDAN Automotive Group, committed to making car buying in Nigeria transparent, fair and safe." },
  { name: "Mr Kunle O. Fagbure", role: "Co-founder", bio: "Co-owner of FAGDAN Automotive Group, helping build a business customers can trust for the long term." },
];

export interface Person { id: string | null; name: string; role: string; bio: string | null; photoUrl: string | null }

export async function getTeam(): Promise<Person[]> {
  const rows = await db.teamMember.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }).catch(() => []);
  if (rows.length) return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, bio: r.bio, photoUrl: r.photoUrl }));
  return DEFAULT_TEAM.map((m) => ({ id: null, ...m, photoUrl: null }));
}

export interface CarouselSlide { id: string; title: string; subtitle: string | null; badge: string | null; imageUrl: string; imageAlt: string; ctaLabel: string | null; ctaHref: string | null }

/** Admin slides first; when none exist (and auto-fill is on) show featured cars and accessories so the banner is never empty. */
export async function getSlides(autoFill: boolean): Promise<CarouselSlide[]> {
  const rows = await db.slide.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }).catch(() => []);
  if (rows.length) return rows.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, badge: r.badge, imageUrl: r.imageUrl, imageAlt: r.imageAlt ?? r.title, ctaLabel: r.ctaLabel, ctaHref: r.ctaHref }));
  if (!autoFill) return [];
  const pick = (type: "VEHICLE" | "ACCESSORY" | "TECHNOLOGY", take: number) =>
    db.product.findMany({
      where: { type, status: "ACTIVE", images: { some: {} } },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }).catch(() => []);
  const [cars, acc, tech] = await Promise.all([pick("VEHICLE", 4), pick("ACCESSORY", 2), pick("TECHNOLOGY", 1)]);
  // alternate cars and accessories
  const order = [cars[0], acc[0], cars[1], tech[0], cars[2], acc[1], cars[3]].filter((p): p is NonNullable<typeof p> => !!p);
  const out: CarouselSlide[] = [];
  for (const p of order) {
    const img = p.images[0];
    if (!img) continue;
    const car = p.type === "VEHICLE";
    out.push({ id: p.id, title: p.name, subtitle: p.shortDescription, badge: car ? "Cars" : "Accessories", imageUrl: img.url, imageAlt: img.alt ?? p.name, ctaLabel: car ? "View car" : "Shop now", ctaHref: car ? `/cars/${p.slug}` : `/shop/${p.slug}` });
  }
  return out;
}
