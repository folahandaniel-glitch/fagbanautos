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
  "site.demoBanner": { value: true, group: "general", label: "Show demo-data banner", type: "boolean" },
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
  return "settings:manage";
}
