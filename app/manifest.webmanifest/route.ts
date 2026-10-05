import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Web App Manifest generated from Admin > Settings > PWA, so name, colours and description are editable without code. */
export async function GET() {
  const s = await getSettings("pwa.");
  const manifest = {
    name: s["pwa.name"],
    short_name: s["pwa.shortName"],
    description: s["pwa.description"],
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: s["pwa.themeColor"],
    background_color: s["pwa.backgroundColor"],
    lang: "en-NG",
    categories: ["automotive", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Browse cars", url: "/cars" },
      { name: "Auto parts", url: "/parts" },
      { name: "Book a service", url: "/auto-care" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
  });
}
