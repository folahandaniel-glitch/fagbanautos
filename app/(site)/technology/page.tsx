import type { Metadata } from "next";
import { getContent } from "@/lib/content";
import { ShopListing } from "@/components/site/ShopListing";

export const metadata: Metadata = { title: "Auto technology", description: "Dashcams, GPS trackers, cameras, head units, audio and vehicle security.", alternates: { canonical: "/technology" } };
export const dynamic = "force-dynamic";

export default async function TechPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await getContent();
  return <ShopListing title={c.t("pages.technology.title")} intro={c.t("pages.technology.intro")} basePath="/technology" divisionSlug="auto-technology" types={["TECHNOLOGY"]} sp={await searchParams} showFitment />;
}
