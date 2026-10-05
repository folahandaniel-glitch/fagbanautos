import { Prisma } from "@prisma/client";
import { db } from "../db";
import { getSettings } from "../settings";

export class BookingError extends Error {}

const LAGOS = "Africa/Lagos";

/** Slot start times are interpreted in Africa/Lagos (UTC+1, no DST). */
export function lagosDate(dateStr: string, hour: number): Date {
  return new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00+01:00`);
}

export async function availability(serviceId: string, location: string, dateStr: string) {
  const [service, s] = await Promise.all([db.service.findUniqueOrThrow({ where: { id: serviceId } }), getSettings()]);
  const open = Number(s["autocare.openHour"]), close = Number(s["autocare.closeHour"]);
  const dayStart = lagosDate(dateStr, 0), dayEnd = new Date(+dayStart + 86_400_000);
  const booked = await db.serviceBooking.findMany({ where: { location, status: { not: "CANCELLED" }, slotStart: { gte: dayStart, lt: dayEnd } }, select: { slotStart: true, slotEnd: true } });
  const slots: { hour: number; start: Date; free: boolean }[] = [];
  for (let h = open; h < close; h++) {
    const start = lagosDate(dateStr, h);
    const end = new Date(+start + service.durationMin * 60_000);
    const withinHours = +end <= +lagosDate(dateStr, close);
    const clash = booked.some((b) => b.slotStart < end && b.slotEnd > start);
    slots.push({ hour: h, start, free: withinHours && !clash && +start > Date.now() });
  }
  return slots;
}

/**
 * Create a booking with no double-booking, even under concurrency:
 * a per-location/day advisory lock serialises the overlap check + insert, and the unique(location, slotStart) index is the backstop.
 */
export async function createBooking(input: { serviceId: string; customerId: string; location: string; dateStr: string; hour: number; vehicleInfo: string; notes?: string; photos?: string[]; isDemo?: boolean }) {
  const s = await getSettings();
  const locations = String(s["autocare.locations"]).split(",").map((x) => x.trim()).filter(Boolean);
  if (!locations.includes(input.location)) throw new BookingError("Please choose a valid location.");
  const open = Number(s["autocare.openHour"]), close = Number(s["autocare.closeHour"]);
  if (input.hour < open || input.hour >= close) throw new BookingError("That time is outside workshop hours.");
  const service = await db.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.isActive) throw new BookingError("This service is not available.");
  const start = lagosDate(input.dateStr, input.hour);
  const end = new Date(+start + service.durationMin * 60_000);
  if (+start <= Date.now()) throw new BookingError("Please choose a future time.");
  if (+end > +lagosDate(input.dateStr, close)) throw new BookingError("This service would run past closing time. Please choose an earlier slot.");
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.location + input.dateStr}))`;
      const clash = await tx.serviceBooking.count({ where: { location: input.location, status: { not: "CANCELLED" }, slotStart: { lt: end }, slotEnd: { gt: start } } });
      if (clash > 0) throw new BookingError("Sorry, that slot has just been taken. Please pick another time.");
      return tx.serviceBooking.create({ data: { serviceId: input.serviceId, customerId: input.customerId, vehicleInfo: input.vehicleInfo, location: input.location, slotStart: start, slotEnd: end, notes: input.notes, photos: input.photos ?? [], isDemo: input.isDemo ?? false } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new BookingError("Sorry, that slot has just been taken. Please pick another time.");
    throw e;
  }
}

export { LAGOS };
