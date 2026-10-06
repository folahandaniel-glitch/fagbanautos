import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { ShopListing } from "@/components/site/ShopListing";

export const metadata: Metadata = { title: "Car accessories", description: "Seat covers, floor mats, chargers, dashcams, cleaning and detailing products for every car.", alternates: { canonical: "/accessories" } };
export const dynamic = "force-dynamic";

export default async function AccessoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await getContent();
  return <ShopListing title={c.t("pages.accessories.title")} intro={c.t("pages.accessories.intro")} basePath="/accessories" divisionSlug="auto-accessories" types={["ACCESSORY"]} sp={await searchParams} showFitment />;
}
