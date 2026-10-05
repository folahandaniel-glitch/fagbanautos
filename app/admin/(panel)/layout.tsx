import Link from "next/link";
import Image from "next/image";
import { requireStaffPage } from "@/lib/auth/guard";
import { logout } from "@/app/actions/auth";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { ROLES } from "@/lib/rbac/permissions";

const NAV: (NavItem & { perm?: string[] })[] = [
  { href: "/admin", label: "Command centre" },
  { href: "/admin/search", label: "Global search" },
  { href: "/admin/orders", label: "Orders", perm: ["orders:view"] },
  { href: "/admin/payments", label: "Payments", perm: ["payments:view"] },
  { href: "/admin/vat", label: "VAT", perm: ["vat:view"] },
  { href: "/admin/inventory", label: "Inventory", perm: ["vehicles:view", "products:view", "inventory:view"] },
  { href: "/admin/import", label: "Excel import", perm: ["inventory:import", "vehicles:import", "products:import"] },
  { href: "/admin/workflows/leads", label: "Leads (CRM)", perm: ["leads:view"] },
  { href: "/admin/workflows/bookings", label: "Service bookings", perm: ["bookings:view"] },
  { href: "/admin/workflows/imports", label: "Import cases", perm: ["imports:view"] },
  { href: "/admin/workflows/tradeins", label: "Trade-ins", perm: ["tradeins:view"] },
  { href: "/admin/workflows/swaps", label: "Car swaps", perm: ["swaps:view"] },
  { href: "/admin/workflows/finance", label: "Finance applications", perm: ["finance_applications:view"] },
  { href: "/admin/workflows/tasks", label: "Tasks", perm: ["tasks:view"] },
  { href: "/admin/reports", label: "Reports and exports", perm: ["reports:view"] },
  { href: "/admin/cms", label: "Content (CMS)", perm: ["content:view", "banners:view", "blog:view"] },
  { href: "/admin/divisions", label: "Divisions", perm: ["divisions:view", "settings:manage"] },
  { href: "/admin/settings", label: "System settings", perm: ["settings:view", "settings:manage", "settings:vat"] },
  { href: "/admin/users", label: "Staff and roles", perm: ["users:view", "users:manage_admins"] },
  { href: "/admin/audit", label: "Audit log", perm: ["audit:view"] },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const roleName = ROLES.find((r) => r.key === user.roleKey)?.name ?? "Staff";
  const items = NAV.filter((n) => !n.perm || n.perm.some((p) => user.permissions.has(p)));
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-navy text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <Image src="/brand/logo.png" alt="" width={48} height={40} className="h-10 w-auto rounded-lg bg-white p-1" />
          <div className="leading-tight"><p className="font-display text-sm font-extrabold">FAGDAN Admin</p><p className="text-[11px] text-accent">{roleName}</p></div>
        </div>
        <AdminNav items={items} />
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 sm:px-6">
          <form action="/admin/search" className="hidden w-80 sm:block" role="search"><label htmlFor="admin-q" className="sr-only">Search everything</label><input id="admin-q" name="q" className="input" placeholder="Search customers, orders, VIN, SKU…" /></form>
          <div className="ml-auto flex items-center gap-3 text-sm"><Link href="/admin/profile" className="font-medium text-navy hover:underline">{user.name}</Link><Link href="/" className="text-muted hover:text-brand">View site</Link>
            <form action={logout}><button className="btn-ghost !min-h-9 !px-3 text-xs">Sign out</button></form></div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
