import type { Metadata } from "next";
import { ShopListing } from "@/components/site/ShopListing";

export const metadata: Metadata = { title: "Auto technology", description: "Dashcams, GPS trackers, cameras, head units, audio and vehicle security.", alternates: { canonical: "/technology" } };
export const dynamic = "force-dynamic";

export default async function TechPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopListing title="Auto Technology" intro="Smarter, safer, connected driving: dashcams, trackers, cameras, head units, audio and security." basePath="/technology" divisionSlug="auto-technology" types={["TECHNOLOGY"]} sp={await searchParams} showFitment />;
}
