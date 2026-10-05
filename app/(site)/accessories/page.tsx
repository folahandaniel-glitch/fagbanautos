import type { Metadata } from "next";
import { ShopListing } from "@/components/site/ShopListing";

export const metadata: Metadata = { title: "Car accessories", description: "Seat covers, floor mats, chargers, dashcams, cleaning and detailing products for every car.", alternates: { canonical: "/accessories" } };
export const dynamic = "force-dynamic";

export default async function AccessoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ShopListing title="Auto Accessories" intro="Beautify, protect and enhance your vehicle. Choose your car to see vehicle-specific covers and mats." basePath="/accessories" divisionSlug="auto-accessories" types={["ACCESSORY"]} sp={await searchParams} showFitment />;
}
