import { cache } from "react";
import { getSettings } from "./settings";

export interface Site {
  name: string; flagship: string; tagline: string; logo: string; favicon: string;
  primary: string; accent: string; navy: string;
  phone1: string; phone2: string; email: string; address: string; hours: string;
  creditText: string; creditPhone: string;
  social: { label: string; href: string }[];
  appUrl: string; demoBanner: boolean; indexDemo: boolean;
  seoTitle: string; seoDescription: string;
}

export const getSite = cache(async (): Promise<Site> => {
  const s = await getSettings();
  const str = (k: string) => String(s[k] ?? "");
  const social = [["Facebook", "social.facebook"], ["Instagram", "social.instagram"], ["X", "social.x"], ["YouTube", "social.youtube"], ["TikTok", "social.tiktok"]]
    .map(([label, k]) => ({ label, href: str(k) })).filter((x) => x.href);
  return {
    name: str("brand.name"), flagship: str("brand.flagship"), tagline: str("brand.tagline"), logo: str("brand.logo"), favicon: str("brand.favicon"),
    primary: str("brand.primary"), accent: str("brand.accent"), navy: str("brand.navy"),
    phone1: str("contact.phone1"), phone2: str("contact.phone2"), email: str("contact.email"), address: str("contact.address"), hours: str("contact.hours"),
    creditText: str("footer.credit"), creditPhone: str("footer.creditPhone"), social,
    appUrl: process.env.APPLICATION_URL ?? "http://localhost:3000",
    demoBanner: s["site.demoBanner"] === true, indexDemo: s["seo.indexDemo"] === true,
    seoTitle: str("seo.siteTitle"), seoDescription: str("seo.siteDescription"),
  };
});

/** +2348067578112 -> 0806 757 8112 (display) */
export function displayPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  const local = d.startsWith("234") ? `0${d.slice(3)}` : d;
  return local.length === 11 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : e164;
}

export function waLink(e164: string, text?: string): string {
  const d = e164.replace(/\D/g, "");
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
