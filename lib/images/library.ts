import type { ProductType } from "@prisma/client";
import { db } from "../db";
import { storeFile } from "../uploads";
import { downloadImage, searchCommons, type FoundPhoto } from "./commons";
import { optimiseImage } from "./optimize";

export interface StoredPhoto { url: string; width: number; height: number; bytes: number; credit: string | null; sourceUrl: string | null }

/** What to search for, best query first. Vehicles use make/model/year; accessories and parts use a plain-language category phrase. */
const CATEGORY_QUERY: Record<string, string> = {
  "Leather Seat Covers": "car leather seat cover", "Fabric Seat Covers": "car seat cover", "Custom Seat Covers": "car seat covers", "Headrest Covers": "car headrest", "Seat Cushions": "car seat cushion",
  "Steering Wheel Covers": "steering wheel cover", "Dashboard Covers and Mats": "car dashboard", "Floor Mats": "car floor mat", "Car Carpets": "car floor mat", "Boot Mats": "car trunk mat",
  Sunshades: "car sunshade windshield", "Rain Guards": "car window visor", "Window Tint": "car window tint", "Phone Holders": "car phone holder", "Wireless Phone Holders": "car phone holder",
  "USB Chargers": "car charger usb", "Car Chargers": "car charger", "LED Interior Lights": "car interior led light", "Ambient Lighting": "car ambient lighting", "Boot Organizers": "car trunk organizer",
  "Car Organizers": "car organizer", "Car Covers": "car cover", "Mud Flaps": "mud flap", "Door Edge Guards": "car door edge guard", "Paint Protection Film": "paint protection film car",
  "Air Fresheners": "car air freshener", "Cleaning Kits": "car cleaning kit", "Car Polish": "car wax polish", "Dashboard Polish": "car dashboard polish", "Tyre Shine": "tyre shine", "Microfiber Towels": "microfiber towel car",
  "Vacuum Cleaners": "car vacuum cleaner", "Pressure Washers": "pressure washer", "Detailing Kits": "car detailing", "Tyre Products": "car tyre", Dashcams: "dashcam", "GPS Trackers": "gps tracker",
  "Reverse Cameras": "reversing camera car", "Parking Sensors": "parking sensor car", "Head Units and Screens": "car head unit android", Speakers: "car speaker", Amplifiers: "car amplifier", Subwoofers: "car subwoofer",
  "Wireless CarPlay Devices": "apple carplay", "Android Auto Devices": "android auto", "Car Wi-Fi": "car wifi router", "Security Systems": "car alarm", "Tyre Pressure Monitoring": "tire pressure monitoring",
  "Brake Pads": "brake pads", "Brake Discs": "brake disc rotor", "Oil Filters": "oil filter", "Air Filters": "engine air filter", "Cabin Filters": "cabin air filter", "Fuel Filters": "fuel filter",
  Batteries: "car battery", Alternators: "car alternator", Starters: "starter motor car", "Spark Plugs and Ignition": "spark plug", "Ignition Coils": "ignition coil", Radiators: "car radiator", "Water Pumps": "water pump car",
  "Shock Absorbers": "shock absorber", "Control Arms": "control arm suspension", "Ball Joints": "ball joint", "Timing Belts and Chains": "timing belt", Belts: "serpentine belt", Headlights: "car headlight",
  "Tail Lights": "car tail light", "Fog Lights": "fog light car", Bumpers: "car bumper", Grilles: "car grille", Mirrors: "car side mirror", Wipers: "windshield wiper", "Air Conditioning Parts": "car air conditioning compressor",
  "Transmission Parts": "car transmission", "Steering Components": "steering rack", "Wheel Components": "wheel bearing hub", "Exhaust Components": "catalytic converter", "Fuel System": "fuel pump", Sensors: "oxygen sensor car",
};

export function photoQueries(p: { type: ProductType; name: string; category?: string | null; make?: string | null; model?: string | null; year?: number | null }): string[] {
  if (p.type === "VEHICLE" && p.make && p.model) {
    const base = [p.year ? `${p.year} ${p.make} ${p.model}` : "", `${p.make} ${p.model}`].filter(Boolean);
    return base;
  }
  const cat = p.category ? CATEGORY_QUERY[p.category] ?? p.category : "";
  return [cat, p.name.split(" - ")[0]].filter(Boolean);
}

const STOP = new Set(["car", "cars", "auto", "automotive", "with", "the", "and", "for", "view"]);
const keywords = (q: string) => q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^d+$/.test(w) && !STOP.has(w));

const cache = new Map<string, Promise<StoredPhoto[]>>();

async function storeFound(photo: FoundPhoto, folder: string): Promise<StoredPhoto> {
  const raw = await downloadImage(photo.url);
  const opt = await optimiseImage(raw);
  const url = await storeFile(opt.bytes, opt.ext, opt.mime, folder);
  return { url, width: opt.width, height: opt.height, bytes: opt.bytes.length, credit: photo.credit, sourceUrl: photo.sourceUrl };
}

/** Finds, compresses and stores up to `want` licensed photos. Results are cached per query within a process (demo catalogues reuse them). */
export async function findStoredPhotos(queries: string[], want: number, vehicle: boolean, folder = "products"): Promise<StoredPhoto[]> {
  const key = `${vehicle}|${want}|${queries.join("|")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const stored: StoredPhoto[] = [];
    for (const q of queries) {
      if (stored.length >= want) break;
      let found: FoundPhoto[] = [];
      try { found = await searchCommons(q, want - stored.length + 2, { vehicle, mustMatch: keywords(q) }); } catch (e) { console.warn("[photos] search failed", q, (e as Error).message); continue; }
      for (const f of found) {
        if (stored.length >= want) break;
        try { stored.push(await storeFound(f, folder)); } catch (e) { console.warn("[photos] skip", f.title, (e as Error).message); }
      }
    }
    return stored;
  })();
  cache.set(key, job);
  return job;
}

/** Attach photos to a product. Real photos replace generated placeholders; existing real photos are kept and appended after. */
export async function attachPhotos(productId: string, photos: StoredPhoto[], alt: string): Promise<number> {
  if (photos.length === 0) return 0;
  await db.productImage.deleteMany({ where: { productId, isPlaceholder: true } });
  const start = await db.productImage.count({ where: { productId } });
  await db.productImage.createMany({
    data: photos.map((p, i) => ({ productId, url: p.url, alt: `${alt} (photo ${start + i + 1})`, sortOrder: start + i, isPlaceholder: false, credit: p.credit, sourceUrl: p.sourceUrl, width: p.width, height: p.height, bytes: p.bytes })),
  });
  await db.product.update({ where: { id: productId }, data: { needsImage: false } });
  return photos.length;
}

/** Automatic photo finder for one product. Returns how many photos were added. */
export async function autoPhotosForProduct(productId: string, want = 3): Promise<number> {
  const p = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { vehicle: true, category: true } });
  const queries = photoQueries({ type: p.type, name: p.name, category: p.category?.name, make: p.vehicle?.makeName, model: p.vehicle?.modelName, year: p.vehicle?.year });
  const photos = await findStoredPhotos(queries, want, p.type === "VEHICLE");
  return attachPhotos(productId, photos, p.name);
}

export async function addOptimisedUpload(productId: string, stored: { url: string; width: number; height: number; bytes: number }, alt: string, isFirstReal: boolean) {
  if (isFirstReal) await db.productImage.deleteMany({ where: { productId, isPlaceholder: true } });
  const count = await db.productImage.count({ where: { productId } });
  const img = await db.productImage.create({ data: { productId, url: stored.url, alt, sortOrder: count, isPlaceholder: false, width: stored.width, height: stored.height, bytes: stored.bytes } });
  await db.product.update({ where: { id: productId }, data: { needsImage: false } });
  return img;
}
