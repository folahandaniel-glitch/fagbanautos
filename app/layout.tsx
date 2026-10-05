import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { getSite } from "@/lib/site";
import { getSetting } from "@/lib/settings";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    metadataBase: new URL(site.appUrl),
    title: { default: site.seoTitle, template: `%s | ${site.flagship}` },
    description: site.seoDescription,
    applicationName: site.flagship,
    manifest: "/manifest.webmanifest",
    alternates: { canonical: "/" },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: site.flagship, statusBarStyle: "black-translucent" },
    openGraph: { type: "website", siteName: site.flagship, title: site.seoTitle, description: site.seoDescription, locale: "en_NG", images: [{ url: "/icons/og-image.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: site.seoTitle, description: site.seoDescription, images: ["/icons/og-image.png"] },
    robots: site.indexDemo ? undefined : { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getSetting<string>("pwa.themeColor");
  return { themeColor: theme, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const css = `:root{--brand:${site.primary};--accent:${site.accent};--navy:${site.navy}}`;
  return (
    <html lang="en-NG" className={`${inter.variable} ${sora.variable} h-full`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
