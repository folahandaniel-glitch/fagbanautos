import { NextRequest } from "next/server";
import { findPhotosBatch } from "@/lib/images/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily Vercel Cron (see vercel.json): finds real photos for listings still showing an illustration. Protected by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json(await findPhotosBatch(10, 45_000));
}
