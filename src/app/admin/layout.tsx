import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/app/app-shell";
import type { NavItem } from "@/components/app/nav";
import { requireAdmin } from "@/lib/auth/session";
import { LangProvider } from "@/lib/i18n/client";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · HisabMitra Admin" }, robots: { index: false } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/owners", label: "Owners", icon: "owners" },
  { href: "/admin/pricing", label: "Pricing", icon: "pricing" },
  { href: "/admin/settings", label: "Settings", icon: "global" },
  { href: "/admin/audit", label: "Audit log", icon: "audit" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  // Server-verified role. Every page and action below checks again.
  const ctx = await requireAdmin();
  const { count } = await ctx.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).is("read_at", null);
  return (
    <LangProvider lang="en">
      <AppShell
        home="/admin"
        sidebar={NAV}
        bottom={NAV}
        title={<p className="text-[0.95rem] font-semibold text-ink">Admin</p>}
        bellHref="/admin/notifications"
        unread={count ?? 0}
        signOutLabel="Logout"
      >
        {children}
      </AppShell>
    </LangProvider>
  );
}
