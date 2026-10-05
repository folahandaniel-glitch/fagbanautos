import type { Metadata } from "next";
import { ShopListing } from "@/components/site/ShopListing";

export const metadata: Metadata = { title: "Auto parts", description: "OEM and aftermarket auto parts matched to your car by make, model and year.", alternates: { canonical: "/parts" } };
export const dynamic = "force-dynamic";

export default async function PartsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopListing title="Auto Parts" intro="OEM and aftermarket parts matched to your vehicle. Enter your car's make, model and year to see only parts that fit." basePath="/parts" divisionSlug="auto-parts" types={["PART"]} sp={await searchParams} showFitment />;
}
