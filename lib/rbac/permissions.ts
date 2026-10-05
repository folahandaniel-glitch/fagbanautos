/**
 * Permission catalogue and role matrix.
 * Keys are "resource:action". Authorisation is enforced server-side by `requirePermission` (lib/auth/guard.ts).
 * SUPER_ADMIN holds the wildcard and is the only role with the financial-authority keys.
 */
export const ACTIONS = ["view", "create", "edit", "delete", "publish", "approve", "reject", "export", "import", "verify", "refund", "override", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "vehicles", "products", "inventory", "categories", "divisions", "orders", "payments", "installments", "vat", "reports", "analytics",
  "customers", "leads", "quotes", "complaints", "tasks", "campaigns", "promotions", "banners", "coupons", "content", "seo", "blog",
  "tradeins", "swaps", "valuations", "bookings", "services", "imports", "finance_applications", "delivery", "users", "roles", "audit",
  "settings", "integrations", "system", "notifications", "documents",
] as const;
export type Resource = (typeof RESOURCES)[number];

/** Keys only the Super Admin may hold (financial authority, section 40 of the spec). */
export const SUPER_ONLY = [
  "settings:vat", "settings:installment", "settings:bank", "settings:paystack", "settings:refund", "settings:pricing",
  "orders:override", "payments:override", "release:override", "roles:manage", "users:manage_admins",
] as const;

export const ALL_PERMISSION_KEYS: string[] = [
  ...RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r}:${a}`)),
  ...SUPER_ONLY,
];

type Grant = string; // "resource:action" or "resource:*"

export interface RoleDef {
  key: string;
  name: string;
  description: string;
  grants: Grant[];
}

const crud = (r: string) => [`${r}:view`, `${r}:create`, `${r}:edit`, `${r}:delete`];
const rw = (r: string) => [`${r}:view`, `${r}:create`, `${r}:edit`];

export const ROLES: RoleDef[] = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Ultimate system authority. Unrestricted, fully audited.", grants: ["*"] },
  {
    key: "INVENTORY_MANAGER", name: "Inventory Manager", description: "Vehicles, stock, specifications and inventory import.",
    grants: [...crud("vehicles"), ...crud("products"), ...crud("inventory"), ...rw("categories"), "vehicles:publish", "products:publish", "inventory:import", "inventory:export", "vehicles:import", "products:import", "vehicles:export", "products:export", "reports:view"],
  },
  {
    key: "SALES_MANAGER", name: "Sales Manager", description: "Sales, leads, quotes and customers.",
    grants: ["orders:view", "orders:edit", ...rw("leads"), ...rw("quotes"), "customers:view", "customers:edit", "vehicles:view", "products:view", "reports:view", "orders:export", "leads:export", "tasks:view", "tasks:create", "tasks:edit", "documents:view", "documents:create"],
  },
  {
    key: "FINANCE_MANAGER", name: "Finance Manager", description: "Payments, installments, VAT and financial reports.",
    grants: ["payments:view", "payments:verify", "payments:approve", "payments:reject", "payments:export", "installments:view", "installments:edit", "vat:view", "vat:approve", "vat:export", "orders:view", "orders:export", "reports:view", "reports:export", "payments:refund", "finance_applications:view", "finance_applications:edit", "finance_applications:approve", "documents:view", "documents:create"],
  },
  {
    key: "CUSTOMER_RELATIONS", name: "Customer Relations Manager", description: "Customers, complaints, enquiries and follow-ups.",
    grants: ["customers:view", "customers:edit", "customers:create", ...rw("complaints"), ...rw("leads"), ...rw("tasks"), "orders:view", "notifications:view", "notifications:create", "bookings:view"],
  },
  {
    key: "MARKETING_MANAGER", name: "Marketing Manager", description: "Campaigns, promotions, banners and featured products.",
    grants: [...crud("campaigns"), ...crud("promotions"), ...crud("banners"), ...crud("coupons"), "campaigns:publish", "banners:publish", "promotions:publish", "products:view", "products:edit", "vehicles:view", "analytics:view"],
  },
  {
    key: "CONTENT_SEO_MANAGER", name: "Content and SEO Manager", description: "Website content, SEO, blog and vehicle descriptions.",
    grants: [...crud("content"), ...crud("blog"), ...rw("seo"), "content:publish", "blog:publish", "seo:publish", "vehicles:view", "vehicles:edit", "products:view", "products:edit", "analytics:view"],
  },
  {
    key: "TRADEIN_SWAP_MANAGER", name: "Trade-in and Swap Manager", description: "Trade-ins, valuations and car swaps.",
    grants: [...rw("tradeins"), ...rw("swaps"), ...rw("valuations"), "tradeins:approve", "swaps:approve", "valuations:approve", "customers:view", "vehicles:view", "documents:create", "documents:view"],
  },
  {
    key: "AUTO_CARE_MANAGER", name: "Auto Care Manager", description: "Service bookings, workshop services and maintenance requests.",
    grants: [...crud("bookings"), ...rw("services"), "customers:view", "notifications:create", "bookings:approve"],
  },
  {
    key: "IMPORTS_MANAGER", name: "Imports Manager", description: "Vehicle sourcing, imports, shipping and documentation.",
    grants: [...rw("imports"), "imports:approve", ...rw("delivery"), "documents:view", "documents:create", "customers:view", "notifications:create"],
  },
  {
    key: "TECH_ADMIN", name: "Technical and System Administrator", description: "Technical configuration, monitoring, integrations and system health.",
    grants: ["system:view", "system:manage", "integrations:view", "integrations:edit", "audit:view", "settings:view", "users:view", "analytics:view", "notifications:view"],
  },
  { key: "CUSTOMER", name: "Customer", description: "Storefront customer.", grants: [] },
];

export function grantsToKeys(grants: Grant[]): string[] {
  if (grants.includes("*")) return [...ALL_PERMISSION_KEYS];
  const out = new Set<string>();
  for (const g of grants) {
    if (g.endsWith(":*")) {
      const r = g.slice(0, -2);
      ACTIONS.forEach((a) => out.add(`${r}:${a}`));
    } else out.add(g);
  }
  for (const k of out) {
    if (!ALL_PERMISSION_KEYS.includes(k)) throw new Error(`Unknown permission key in role matrix: ${k}`);
  }
  return [...out];
}

export function roleKeys(roleKey: string): string[] {
  const r = ROLES.find((x) => x.key === roleKey);
  return r ? grantsToKeys(r.grants) : [];
}

/** Pure check used by guards and tests. */
export function can(roleKey: string | null | undefined, permission: string): boolean {
  if (!roleKey) return false;
  return roleKeys(roleKey).includes(permission);
}
