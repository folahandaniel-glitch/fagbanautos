import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { ShopListing } from "@/components/site/ShopListing";

export const metadata: Metadata = { title: "Auto parts", description: "OEM and aftermarket auto parts matched to your car by make, model and year.", alternates: { canonical: "/parts" } };
export const dynamic = "force-dynamic";

export default async function PartsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await getContent();
  return <ShopListing title={c.t("pages.parts.title")} intro={c.t("pages.parts.intro")} basePath="/parts" divisionSlug="auto-parts" types={["PART"]} sp={await searchParams} showFitment />;
}
