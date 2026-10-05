import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ShopListing } from "@/components/site/ShopListing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await db.division.findUnique({ where: { slug: (await params).slug } });
  return d ? { title: d.name, description: d.description ?? undefined } : {};
}

/** Any division the Super Admin creates is automatically served here, with no code change. */
export default async function DivisionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const d = await db.division.findUnique({ where: { slug } });
  if (!d || !d.isVisible) notFound();
  return <ShopListing title={d.name} intro={d.description ?? d.tagline ?? ""} basePath={`/division/${d.slug}`} divisionSlug={d.slug} types={["VEHICLE", "PART", "ACCESSORY", "TECHNOLOGY", "OTHER"]} sp={await searchParams} showFitment={false} />;
}
