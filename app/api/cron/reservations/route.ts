import { NextRequest } from "next/server";
import { expireReservations } from "@/lib/services/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron (see vercel.json). Protected by CRON_SECRET sent as a Bearer token. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const n = await expireReservations();
  return Response.json({ expired: n });
}
