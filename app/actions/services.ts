"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { createBooking, BookingError } from "@/lib/services/bookings";
import { PHOTO_RULE, UploadError, storeFile, validateUpload } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";
import { nairaToKobo } from "@/lib/money";

async function customerOrLogin(next: string) {
  const u = await getSessionUser();
  if (!u || !u.customerId) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return u as typeof u & { customerId: string };
}

async function savePhotos(files: FormDataEntryValue[], folder: string): Promise<string[]> {
  const out: string[] = [];
  for (const f of files.slice(0, 4)) {
    if (!(f instanceof File) || f.size === 0) continue;
    const v = await validateUpload(f, PHOTO_RULE);
    out.push(await storeFile(v.bytes, v.ext, v.mime, folder));
  }
  return out;
}

const bookingSchema = z.object({ serviceId: z.string().min(1), slug: z.string(), location: z.string().min(2), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hour: z.coerce.number().int().min(0).max(23), vehicleInfo: z.string().trim().min(3).max(200), notes: z.string().max(600).optional() });

export async function bookService(formData: FormData) {
  const d = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!d.success) redirect("/auto-care?error=invalid");
  const u = await customerOrLogin(`/auto-care/${d.data.slug}`);
  if (!(await rateLimit("booking", 8, 600))) redirect(`/auto-care/${d.data.slug}?error=${encodeURIComponent("Too many attempts. Please wait.")}`);
  try {
    const photos = await savePhotos(formData.getAll("photos"), "booking-photos");
    const b = await createBooking({ serviceId: d.data.serviceId, customerId: u.customerId, location: d.data.location, dateStr: d.data.date, hour: d.data.hour, vehicleInfo: d.data.vehicleInfo, notes: d.data.notes, photos });
    await db.notification.create({ data: { userId: u.id, event: "booking.confirmed", title: "Service booking confirmed", body: `Your booking for ${b.slotStart.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} at ${b.location} is confirmed.` } });
  } catch (e) {
    if (e instanceof BookingError || e instanceof UploadError) redirect(`/auto-care/${d.data.slug}?error=${encodeURIComponent(e.message)}&date=${d.data.date}&location=${encodeURIComponent(d.data.location)}`);
    throw e;
  }
  redirect("/thank-you?type=booking");
}

const importSchema = z.object({
  make: z.string().trim().min(2).max(60), model: z.string().trim().min(1).max(60), year: z.coerce.number().int().min(1990).max(2030).optional(), trim: z.string().max(60).optional(),
  country: z.string().min(2).max(40), budgetNaira: z.coerce.number().min(0).max(5_000_000_000).optional(), condition: z.string().max(40).optional(), colour: z.string().max(40).optional(),
  specs: z.string().max(800).optional(), quantity: z.coerce.number().int().min(1).max(50).default(1), notes: z.string().max(1000).optional(),
});

export async function requestImport(formData: FormData) {
  const u = await customerOrLogin("/imports/request");
  if (!(await rateLimit("import", 5, 900))) redirect("/imports/request?error=rate");
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, v === "" ? undefined : v]));
  const d = importSchema.safeParse(raw);
  if (!d.success) redirect("/imports/request?error=invalid");
  const count = await db.importCase.count();
  const c = await db.importCase.create({
    data: { caseNumber: `IMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, customerId: u.customerId, make: d.data.make, model: d.data.model, year: d.data.year, trim: d.data.trim, country: d.data.country, budget: d.data.budgetNaira != null ? BigInt(nairaToKobo(d.data.budgetNaira)) : null, condition: d.data.condition, colour: d.data.colour, specs: d.data.specs, quantity: d.data.quantity, notes: d.data.notes, events: { create: { status: "REQUEST_RECEIVED", note: "Request received" } } },
  });
  await db.lead.create({ data: { customerId: u.customerId, name: u.name, source: "Import request", interest: `${d.data.make} ${d.data.model} from ${d.data.country} (${c.caseNumber})`, stage: "NEW", priority: "HIGH", nextAction: "Contact customer and start sourcing" } });
  redirect(`/thank-you?type=import&ref=${c.caseNumber}`);
}

const financeSchema = z.object({ vehiclePriceNaira: z.coerce.number().min(100_000).max(5_000_000_000), depositNaira: z.coerce.number().min(0), termMonths: z.coerce.number().int().min(3).max(60), productId: z.string().optional(), notes: z.string().max(800).optional() });

export async function applyFinance(formData: FormData) {
  const u = await customerOrLogin("/finance/apply");
  if (!(await rateLimit("finance", 5, 900))) redirect("/finance/apply?error=rate");
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, v === "" ? undefined : v]));
  const d = financeSchema.safeParse(raw);
  if (!d.success || d.data.depositNaira >= d.data.vehiclePriceNaira) redirect("/finance/apply?error=invalid");
  const docs = await savePhotos(formData.getAll("documents"), "finance-docs").catch((e) => { if (e instanceof UploadError) redirect(`/finance/apply?error=${encodeURIComponent(e.message)}`); throw e; });
  await db.financeApplication.create({ data: { customerId: u.customerId, productId: d.data.productId, vehiclePrice: BigInt(nairaToKobo(d.data.vehiclePriceNaira)), deposit: BigInt(nairaToKobo(d.data.depositNaira)), requested: BigInt(nairaToKobo(d.data.vehiclePriceNaira - d.data.depositNaira)), termMonths: d.data.termMonths, documents: docs, notes: d.data.notes } });
  redirect("/thank-you?type=finance");
}

const tradeSchema = z.object({ kind: z.enum(["TRADE_IN", "SWAP"]), make: z.string().trim().min(2).max(60), model: z.string().trim().min(1).max(60), year: z.coerce.number().int().min(1990).max(2030), mileageKm: z.coerce.number().int().min(0).max(2_000_000).optional(), condition: z.string().max(60).optional(), description: z.string().max(1000).optional(), targetProductId: z.string().optional() });

export async function submitTradeOrSwap(formData: FormData) {
  const u = await customerOrLogin("/sell-or-swap");
  if (!(await rateLimit("trade", 5, 900))) redirect("/sell-or-swap?error=rate");
  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, v === "" ? undefined : v]));
  const d = tradeSchema.safeParse(raw);
  if (!d.success) redirect("/sell-or-swap?error=invalid");
  const photos = await savePhotos(formData.getAll("photos"), "trade-photos").catch((e) => { if (e instanceof UploadError) redirect(`/sell-or-swap?error=${encodeURIComponent(e.message)}`); throw e; });
  if (d.data.kind === "SWAP") {
    await db.swapRequest.create({ data: { customerId: u.customerId, ownVehicle: `${d.data.year} ${d.data.make} ${d.data.model}`, targetProductId: d.data.targetProductId, notes: d.data.description } });
  } else {
    await db.tradeIn.create({ data: { customerId: u.customerId, make: d.data.make, model: d.data.model, year: d.data.year, mileageKm: d.data.mileageKm, condition: d.data.condition, description: d.data.description, photos } });
  }
  redirect(`/thank-you?type=${d.data.kind === "SWAP" ? "swap" : "trade-in"}`);
}
