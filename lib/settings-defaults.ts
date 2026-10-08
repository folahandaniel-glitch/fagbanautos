/** Every business constant lives here as a seed default and is editable in Admin > Settings. Nothing is hardcoded in logic. */
export interface SettingDef {
  value: unknown;
  group: string;
  label: string;
  type?: "text" | "number" | "boolean" | "color" | "textarea" | "select";
  options?: string[];
  help?: string;
}

export const SETTING_DEFS: Record<string, SettingDef> = {
  // Branding
  "brand.name": { value: "FAGDAN AUTOMOTIVE GROUP", group: "branding", label: "Group name" },
  "brand.flagship": { value: "FAGDAN AUTOGALLERY", group: "branding", label: "Flagship division name" },
  "brand.tagline": { value: "Driven by Trust. Powered by Choice.", group: "branding", label: "Tagline" },
  "brand.logo": { value: "/brand/logo.png", group: "branding", label: "Logo URL" },
  "brand.favicon": { value: "/favicon.ico", group: "branding", label: "Favicon URL" },
  "brand.primary": { value: "#0B3A8F", group: "branding", label: "Primary colour", type: "color" },
  "brand.accent": { value: "#C9A227", group: "branding", label: "Accent (gold) colour", type: "color" },
  "brand.navy": { value: "#071F4D", group: "branding", label: "Deep navy surface", type: "color" },
  "footer.credit": { value: "Powered and Maintained by Fodan Softnet", group: "branding", label: "Footer credit" },
  "footer.creditPhone": { value: "+234 806 757 8112", group: "branding", label: "Footer credit phone" },
  // Contact
  "contact.phone1": { value: "+2348067578112", group: "general", label: "Phone / WhatsApp 1" },
  "contact.phone2": { value: "+2348085816869", group: "general", label: "Phone / WhatsApp 2" },
  "contact.email": { value: "info@fagdan.example", group: "general", label: "Contact email", help: "Placeholder until the business email is entered." },
  "contact.address": { value: "Address to be confirmed by FAGDAN", group: "general", label: "Business address" },
  "contact.hours": { value: "Mon-Sat 8:00am - 6:00pm", group: "general", label: "Opening hours" },
  "legal.entityName": { value: "FAGDAN Automotive Group (legal entity to be confirmed)", group: "general", label: "Legal entity" },
  "legal.tin": { value: "", group: "general", label: "Tax identification number (TIN) shown on invoices" },
  "legal.rcNumber": { value: "", group: "general", label: "RC number" },
  "social.facebook": { value: "", group: "social", label: "Facebook URL" },
  "social.instagram": { value: "", group: "social", label: "Instagram URL" },
  "social.x": { value: "", group: "social", label: "X / Twitter URL" },
  "social.youtube": { value: "", group: "social", label: "YouTube URL" },
  "social.tiktok": { value: "", group: "social", label: "TikTok URL" },
  // Currency
  "currency.primary": { value: "NGN", group: "currency", label: "Primary currency" },
  // VAT
  "vat.enabledDefault": { value: true, group: "vat", label: "VAT enabled by default", type: "boolean" },
  "vat.rateBps": { value: 750, group: "vat", label: "VAT rate (basis points, 750 = 7.5%)", type: "number" },
  "vat.buyerCanDisable": { value: false, group: "vat", label: "Buyers may switch VAT off", type: "boolean", help: "VAT is a statutory tax. Leave off unless a documented exemption applies (Decision D1)." },
  "vat.disableForVehicles": { value: false, group: "vat", label: "Allow VAT switch-off on vehicles", type: "boolean" },
  "vat.disableForAccessories": { value: false, group: "vat", label: "Allow VAT switch-off on parts and accessories", type: "boolean" },
  "vat.disableForServices": { value: false, group: "vat", label: "Allow VAT switch-off on services", type: "boolean" },
  "vat.requireReason": { value: true, group: "vat", label: "Require a reason to switch VAT off", type: "boolean" },
  "vat.requireApproval": { value: true, group: "vat", label: "Require approval to switch VAT off", type: "boolean" },
  // Installment
  "installment.upliftBps": { value: 1000, group: "installment", label: "Installment uplift (bps, 1000 = 10%)", type: "number" },
  "installment.releaseThresholdBps": { value: 9000, group: "installment", label: "Release threshold (bps, 9000 = 90%)", type: "number" },
  "installment.thresholdBasis": { value: "VAT_INCLUSIVE_TOTAL", group: "installment", label: "Threshold basis", type: "select", options: ["VAT_INCLUSIVE_TOTAL", "PRE_VAT_PRICE"] },
  "installment.tradeInTreatment": { value: "PART_PAYMENT", group: "installment", label: "Trade-in credit treatment", type: "select", options: ["PART_PAYMENT", "REDUCES_TAXABLE_BASE"] },
  "installment.minDepositBps": { value: 3000, group: "installment", label: "Minimum deposit (bps)", type: "number" },
  // Inventory and orders
  "inventory.reservationHoldHours": { value: 48, group: "inventory", label: "Reservation hold (hours)", type: "number" },
  "inventory.reservationDepositBps": { value: 500, group: "inventory", label: "Reservation deposit (bps of price)", type: "number" },
  "orders.deliveryFeeNaira": { value: 25000, group: "shipping", label: "Default delivery fee (NGN) for parts and accessories", type: "number" },
  "orders.deliveryFeeTaxable": { value: true, group: "shipping", label: "Delivery fee is taxable", type: "boolean" },
  // Payments
  "payments.paystackEnabled": { value: false, group: "payments", label: "Paystack enabled", type: "boolean" },
  "payments.bankTransferEnabled": { value: true, group: "payments", label: "Bank transfer enabled", type: "boolean" },
  "payments.twoPersonApprovalAboveNaira": { value: 50000000, group: "payments", label: "Two-person approval above (NGN)", type: "number" },
  // Auto care
  "autocare.locations": { value: "Ikeja Workshop (demo), Lekki Workshop (demo)", group: "general", label: "Auto Care locations (comma separated)" },
  "autocare.openHour": { value: 9, group: "general", label: "Workshop opens (hour, 24h)", type: "number" },
  "autocare.closeHour": { value: 17, group: "general", label: "Workshop closes (hour, 24h)", type: "number" },
  // PWA
  "pwa.name": { value: "FAGDAN AUTOGALLERY", group: "pwa", label: "App name" },
  "pwa.shortName": { value: "FAGDAN", group: "pwa", label: "Short name" },
  "pwa.description": { value: "Nigeria's premium automotive marketplace: vehicles, parts, accessories, auto care, finance and imports.", group: "pwa", label: "Description", type: "textarea" },
  "pwa.themeColor": { value: "#0B3A8F", group: "pwa", label: "Theme colour", type: "color" },
  "pwa.backgroundColor": { value: "#071F4D", group: "pwa", label: "Background colour", type: "color" },
  "pwa.installPromptEnabled": { value: true, group: "pwa", label: "Install prompt enabled", type: "boolean" },
  "pwa.installPromptDelaySec": { value: 20, group: "pwa", label: "Prompt delay (seconds)", type: "number" },
  "pwa.installPromptFrequencyDays": { value: 14, group: "pwa", label: "Re-prompt after dismissal (days)", type: "number" },
  "pwa.installPromptMessage": { value: "Install FAGDAN on your device for faster access, a better browsing experience and convenient access to your automotive marketplace.", group: "pwa", label: "Prompt message", type: "textarea" },
  // SEO
  "seo.siteTitle": { value: "FAGDAN AutoGallery | Cars, Parts, Accessories and Auto Care in Nigeria", group: "seo", label: "Default title" },
  "seo.siteDescription": { value: "Buy brand new, foreign used and Nigerian used cars, genuine parts, accessories, auto care, vehicle finance and imports from FAGDAN Automotive Group.", group: "seo", label: "Default description", type: "textarea" },
  "seo.indexDemo": { value: false, group: "seo", label: "Allow search engines to index demo data", type: "boolean" },
  // Site
  "site.demoBanner": { value: false, group: "general", label: "Show demo-data banner", type: "boolean" },
  "site.showDemoLabels": { value: false, group: "general", label: "Show a small 'Demo' tag on sample listings", type: "boolean", help: "Sample listings are marked internally either way. Turn this on while testing." },
  "catalogue.allowDemoPurchases": { value: false, group: "general", label: "Allow customers to buy sample (demo) listings", type: "boolean", help: "Off by default: sample listings show an enquiry button instead of Buy, so no one can pay for stock that does not exist. Turn on only for testing checkout." },
  // Homepage (everything on the home page is editable here)
  "home.headline": { value: "Driven by *Trust.*\nPowered by *Choice.*", group: "homepage", label: "Main headline (one line per row; put *asterisks* around gold words)", type: "textarea" },
  "home.subheadline": { value: "Nigeria's premium automotive marketplace: verified vehicles, genuine parts, accessories, expert auto care, flexible financing and global imports, all under one roof.", group: "homepage", label: "Sub-headline", type: "textarea" },
  "home.searchPlaceholder": { value: "Make, model or keyword, e.g. Toyota Camry", group: "homepage", label: "Hero search placeholder" },
  "home.searchButton": { value: "Search", group: "homepage", label: "Hero search button" },
  "home.cta1Label": { value: "EXPLORE VEHICLES", group: "homepage", label: "Primary button text" },
  "home.cta1Href": { value: "/cars", group: "homepage", label: "Primary button link" },
  "home.cta2Label": { value: "FIND YOUR NEXT CAR", group: "homepage", label: "Secondary button text" },
  "home.cta2Href": { value: "/imports", group: "homepage", label: "Secondary button link" },
  "home.heroImage": { value: "", group: "homepage", label: "Hero picture URL (shown when 3D is unavailable; leave blank for the default artwork)", help: "Use a wide https image URL, or upload one in Content > Banners and paste its link." },
  "home.stat1Label": { value: "Vehicles listed", group: "homepage", label: "Stat 1 label (value counts your live vehicles)" },
  "home.stat2Label": { value: "Divisions", group: "homepage", label: "Stat 2 label (value counts your visible divisions)" },
  "home.stat3Value": { value: "24/7", group: "homepage", label: "Stat 3 value" },
  "home.stat3Label": { value: "WhatsApp support", group: "homepage", label: "Stat 3 label" },
  "home.featuredTitle": { value: "Featured vehicles", group: "homepage", label: "Featured vehicles heading" },
  "home.featuredLink": { value: "View all cars", group: "homepage", label: "Featured vehicles link text" },
  "home.shopByTitle": { value: "Shop by body type", group: "homepage", label: "Body-type panel heading" },
  "home.bodyTypes": { value: "SUV, Sedan, Pickup, Hatchback, Coupe, Van", group: "homepage", label: "Body types shown (comma separated)" },
  "home.makesTitle": { value: "Popular makes", group: "homepage", label: "Popular makes heading" },
  "home.financeBadge": { value: "FAGDAN Vehicle Finance", group: "homepage", label: "Finance panel badge" },
  "home.financeTitle": { value: "Own it now. Pay in installments.", group: "homepage", label: "Finance panel heading" },
  "home.financeText": { value: "Eligible vehicles are available on FAGDAN installment terms. A transparent price, a clear schedule, and release once at least 90% is paid and verified.", group: "homepage", label: "Finance panel text", type: "textarea" },
  "home.financeCta1": { value: "How it works", group: "homepage", label: "Finance button 1 text" },
  "home.financeCta2": { value: "Installment cars", group: "homepage", label: "Finance button 2 text" },
  "home.accessoriesTitle": { value: "Accessories & technology for every drive", group: "homepage", label: "Accessories section heading" },
  "home.accessoriesLink": { value: "Shop all", group: "homepage", label: "Accessories link text" },
  "home.trust1Title": { value: "Verified and transparent", group: "homepage", label: "Trust card 1 title" },
  "home.trust1Text": { value: "Every listing shows its inspection status, origin and full price breakdown, including VAT, before you pay.", group: "homepage", label: "Trust card 1 text", type: "textarea" },
  "home.trust2Title": { value: "Secure payments", group: "homepage", label: "Trust card 2 title" },
  "home.trust2Text": { value: "Pay with card, bank transfer or USSD via Paystack, or by verified bank transfer. Server-side verification on every payment.", group: "homepage", label: "Trust card 2 text", type: "textarea" },
  "home.trust3Title": { value: "We source it for you", group: "homepage", label: "Trust card 3 title" },
  "home.trust3Text": { value: "Can't find your car? FAGDAN Imports sources, ships, clears and delivers from Japan, USA, Canada, Germany, Korea, China and the UK.", group: "homepage", label: "Trust card 3 text", type: "textarea" },
  // Page text
  "pages.cars.title": { value: "Cars for sale", group: "pagetext", label: "Cars page heading" },
  "pages.cars.intro": { value: "Brand new, foreign used, Nigerian used and certified cars with transparent pricing.", group: "pagetext", label: "Cars page intro", type: "textarea" },
  "pages.parts.title": { value: "Auto Parts", group: "pagetext", label: "Parts page heading" },
  "pages.parts.intro": { value: "OEM and aftermarket parts matched to your vehicle. Enter your car's make, model and year to see only parts that fit.", group: "pagetext", label: "Parts page intro", type: "textarea" },
  "pages.accessories.title": { value: "Auto Accessories", group: "pagetext", label: "Accessories page heading" },
  "pages.accessories.intro": { value: "Beautify, protect and enhance your vehicle. Choose your car to see vehicle-specific covers and mats.", group: "pagetext", label: "Accessories page intro", type: "textarea" },
  "pages.technology.title": { value: "Auto Technology", group: "pagetext", label: "Technology page heading" },
  "pages.technology.intro": { value: "Smarter, safer, connected driving: dashcams, trackers, cameras, head units, audio and security.", group: "pagetext", label: "Technology page intro", type: "textarea" },
  "pages.autocare.title": { value: "FAGDAN Auto Care", group: "pagetext", label: "Auto Care heading" },
  "pages.autocare.intro": { value: "Expert care for every kilometre. Pick a service, choose a date and location, upload photos of your car and we will confirm instantly.", group: "pagetext", label: "Auto Care intro", type: "textarea" },
  "pages.finance.title": { value: "FAGDAN Vehicle Finance", group: "pagetext", label: "Finance page heading" },
  "pages.finance.intro": { value: "Flexible ways to own your vehicle, with every figure shown before you commit.", group: "pagetext", label: "Finance page intro", type: "textarea" },
  "pages.finance.note": { value: "FAGDAN is not a bank or a licensed lender. Installment terms are a commercial arrangement between you and FAGDAN. Please read the installment terms before you commit.", group: "pagetext", label: "Finance disclaimer", type: "textarea" },
  "pages.imports.title": { value: "FAGDAN Imports", group: "pagetext", label: "Imports page heading" },
  "pages.imports.intro": { value: "Tell us the car you want. We source it, ship it, clear it and keep you updated at every stage.", group: "pagetext", label: "Imports page intro", type: "textarea" },
  "pages.imports.countries": { value: "Japan, USA, Canada, Germany, Korea, China, United Kingdom, Europe", group: "pagetext", label: "Import source countries (comma separated)" },
  "pages.imports.button": { value: "I want FAGDAN to source/import this vehicle", group: "pagetext", label: "Imports button text" },
  "pages.sell.title": { value: "Sell, trade in or swap your car", group: "pagetext", label: "Sell/swap heading" },
  "pages.sell.intro": { value: "Tell us about your car. An appraiser will value it and make you an offer. Use it as a trade-in credit toward your next purchase, or swap it for another vehicle.", group: "pagetext", label: "Sell/swap intro", type: "textarea" },
  "images.autoSearch": { value: true, group: "integrations", label: "Search the web for product photos automatically", type: "boolean" },
  "images.vendorOnly": { value: true, group: "integrations", label: "Only accept photos from the manufacturer official website", type: "boolean" },
  "images.braveKeyEnc": { value: "", group: "integrations", label: "Brave Search API key (encrypted)", type: "text" },
  "security.requireStaff2fa": { value: false, group: "security", label: "Staff must use two-step sign-in", type: "boolean", help: "On: staff without two-step sign-in are sent to their Profile to set it up before they can use the admin. Set up your own first." },
  "security.staffSessionHours": { value: 12, group: "security", label: "Staff are signed out after (hours, 1 to 168)", type: "number" },
  "carousel.enabled": { value: true, group: "homepage", label: "Show the big picture carousel on public pages", type: "boolean" },
  "carousel.seconds": { value: 6, group: "homepage", label: "Carousel: seconds per slide", type: "number" },
  "carousel.auto": { value: true, group: "homepage", label: "Carousel: fill with featured cars and accessories when no slides have been added", type: "boolean", help: "Add your own slides in Admin > Carousel." },
  "pages.about.heading": { value: "About FAGDAN Automotive Group", group: "pagetext", label: "About page heading" },
  "pages.about.story": { value: "FAGDAN Automotive Group is a Nigerian automotive commerce company built on one idea: buying a car, a part or a service should be clear, fair and safe.\n\nThrough FAGDAN AutoGallery we offer new and quality used vehicles, genuine and aftermarket parts, accessories and car technology, auto care, vehicle imports and flexible installment plans, all with transparent pricing, verified listings and secure online payment.\n\nWe are driven by trust and powered by choice. Every customer is treated as a long-term relationship, not a single sale.", group: "pagetext", label: "About page: our story (blank lines start a new paragraph)", type: "textarea" },
  "pages.about.teamTitle": { value: "The people behind FAGDAN", group: "pagetext", label: "About page: team heading" },
  "pages.about.teamIntro": { value: "FAGDAN is owned and led by its founders, who stand behind every vehicle and every promise we make.", group: "pagetext", label: "About page: team introduction", type: "textarea" },
  "pages.footer.divisionsHeading": { value: "Divisions", group: "pagetext", label: "Footer: divisions heading" },
  "pages.footer.companyHeading": { value: "Company", group: "pagetext", label: "Footer: company heading" },
  "pages.footer.contactHeading": { value: "Contact", group: "pagetext", label: "Footer: contact heading" },
  "pages.footer.companyLinks": { value: "About | /about\nContact | /contact\nFAQ | /faq\nDropshipping | /dropshipping\nSell or swap your car | /sell-or-swap", group: "pagetext", label: "Footer: company links (one per line: Label | /page)", type: "textarea" },
  "pages.footer.whatsappLabel": { value: "WhatsApp enquiry", group: "pagetext", label: "Footer: WhatsApp button text" },
  "pages.footer.whatsappMessage": { value: "Hello FAGDAN, I would like to make an enquiry.", group: "pagetext", label: "WhatsApp: message that opens in the chat", type: "textarea" },
  "pages.dropship.title": { value: "More products, delivered straight from our partners", group: "pagetext", label: "Dropshipping page: heading" },
  "pages.dropship.intro": { value: "FAGDAN works with trusted supplying companies. Order their goods here, pay securely, and they ship directly to you, with our receipt, warranty and support.", group: "pagetext", label: "Dropshipping page: introduction", type: "textarea" },
  "pages.about.points": { value: "Trust: transparent pricing and verified listings\nChoice: vehicles, parts, accessories, care, finance and imports\nTechnology: secure online payments and live tracking\nService: people who pick up the phone", group: "pagetext", label: "About page highlights (one per line)", type: "textarea" },
  "pages.contact.intro": { value: "Reach us by phone, WhatsApp, email or the form below. We reply within one business day.", group: "pagetext", label: "Contact page intro", type: "textarea" },
  // Notifications
  "notify.emailEnabled": { value: false, group: "notifications", label: "Email notifications enabled", type: "boolean" },
  "notify.whatsappEnabled": { value: false, group: "notifications", label: "WhatsApp notifications enabled", type: "boolean" },
};

/** Permission required to change a setting. Financial keys are Super-Admin-only. */
export function settingPermission(key: string): string {
  if (key.startsWith("vat.")) return "settings:vat";
  if (key.startsWith("installment.")) return "settings:installment";
  if (key.startsWith("payments.")) return "settings:bank";
  if (key.startsWith("currency.") || key.startsWith("orders.")) return "settings:pricing";
  if (key.startsWith("home.") || key.startsWith("carousel.") || key.startsWith("pages.") || key.startsWith("seo.")) return "content:edit"; // website wording: Content and SEO managers can edit it
  return "settings:manage";
}
