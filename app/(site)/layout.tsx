import { Header, Footer, WhatsAppFab } from "@/components/site/Chrome";
import { MobileBottomNav } from "@/components/site/NavClient";
import { InstallPrompt, PwaRegister } from "@/components/site/PwaClient";
import { getSettings } from "@/lib/settings";
import { getSite } from "@/lib/site";
import { cartCount } from "@/lib/cart";
import { ScrollButtons } from "@/components/ui/ScrollButtons";
import { Carousel } from "@/components/site/Carousel";
import { getSlides } from "@/lib/site-content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, site, count, car] = await Promise.all([getSettings("pwa."), getSite(), cartCount(), getSettings("carousel.")]);
  const slides = car["carousel.enabled"] === false ? [] : await getSlides(car["carousel.auto"] !== false);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      {site.demoBanner && (
        <div role="note" className="bg-accent/90 px-4 py-1.5 text-center text-xs font-semibold text-navy">
          Demo environment: vehicles, products, prices and images are sample data, not real stock.
        </div>
      )}
      <Header />
      <Carousel slides={slides} seconds={Number(car["carousel.seconds"]) || 6} />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFab />
      <ScrollButtons className="bottom-24" />
      <MobileBottomNav cartCount={count} />
      <PwaRegister />
      <InstallPrompt
        enabled={s["pwa.installPromptEnabled"] === true}
        delaySec={Number(s["pwa.installPromptDelaySec"])}
        frequencyDays={Number(s["pwa.installPromptFrequencyDays"])}
        message={String(s["pwa.installPromptMessage"])}
        appName={String(s["pwa.name"])}
      />
    </>
  );
}
