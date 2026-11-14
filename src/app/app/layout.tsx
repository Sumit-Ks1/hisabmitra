import type { Metadata } from "next";
import { AlertTriangle, Megaphone } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/app/app-shell";
import { BuildingSwitcher, type NavItem } from "@/components/app/nav";
import { getSettings } from "@/lib/data/settings";
import { getSubscription, getWorkspace } from "@/lib/data/workspace";
import { fmtDate } from "@/lib/format";
import { LangProvider } from "@/lib/i18n/client";
import { daysBetween } from "@/lib/billing/proration";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · HisabMitra" }, robots: { index: false } };

/**
 * The shell skeleton is static and paints instantly; everything that needs the
 * session streams in behind the Suspense boundary.
 */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <OwnerShell>{children}</OwnerShell>
    </Suspense>
  );
}

async function OwnerShell({ children }: { children: ReactNode }) {
  const ws = await getWorkspace();
  const { t, supabase, userId } = ws;

  const [{ count }, settings, subscription] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    getSettings(supabase, ["announcement"]),
    getSubscription(ws),
  ]);

  const main: NavItem[] = [
    { href: "/app", label: t("Home", "Home"), icon: "home", exact: true },
    { href: "/app/tenants", label: t("Tenants", "Tenants"), icon: "tenants" },
    { href: "/app/rooms", label: t("Rooms", "Rooms"), icon: "rooms" },
    { href: "/app/payments", label: t("Payments", "Payments"), icon: "payments" },
  ];
  const sidebar: NavItem[] = [
    ...main,
    { href: "/app/electricity", label: t("Electricity", "Bijli"), icon: "electricity" },
    { href: "/app/reminders", label: t("Reminders", "Reminders"), icon: "reminders" },
    { href: "/app/reports", label: t("Reports", "Reports"), icon: "reports" },
    { href: "/app/buildings", label: t("Buildings", "Buildings"), icon: "buildings" },
    { href: "/app/settings", label: t("Settings", "Settings"), icon: "settings" },
  ];
  const bottom: NavItem[] = [...main, { href: "/app/more", label: t("More", "More"), icon: "more" }];

  const daysLeft = subscription?.expires_on ? daysBetween(ws.today, subscription.expires_on) : null;
  const expired = subscription?.status === "expired" || (daysLeft !== null && daysLeft < 0);
  const announcement = settings.announcement.active ? settings.announcement.message.trim() : "";

  const banner = (
    <>
      {announcement && (
        <div className="flex items-start gap-2 border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-[0.88rem] text-brand-800 lg:px-8">
          <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{announcement}</p>
        </div>
      )}
      {subscription && (expired || (daysLeft !== null && daysLeft <= 5)) && (
        <div className="flex items-start gap-2 border-b border-warm-400/50 bg-warm-50 px-4 py-2.5 text-[0.88rem] text-warm-800 lg:px-8">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {expired
              ? t("Your subscription has expired. Please contact support to renew.", "Aapka subscription khatam ho gaya hai. Renew ke liye support se baat karein.")
              : t(`Your subscription is valid till ${fmtDate(subscription.expires_on)}.`, `Aapka subscription ${fmtDate(subscription.expires_on)} tak valid hai.`)}
          </p>
        </div>
      )}
    </>
  );

  return (
    <LangProvider lang={ws.lang}>
      <AppShell
        home="/app"
        sidebar={sidebar}
        bottom={bottom}
        title={<BuildingSwitcher buildings={ws.buildings.map((b) => ({ id: b.id, name: b.name }))} current={ws.building.id} />}
        bellHref="/app/notifications"
        unread={count ?? 0}
        banner={banner}
        signOutLabel={t("Logout", "Logout")}
      >
        {children}
      </AppShell>
    </LangProvider>
  );
}
