import Link from "next/link";
import { Bell, Building2, ChartColumn, ChevronRight, Download, MessageCircle, Settings, Zap, type LucideIcon } from "lucide-react";
import { SignOutButton } from "@/components/app/nav";
import { InstallCard } from "@/components/pwa/install-card";
import { PageHeader } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/session";

export const metadata = { title: "More" };

export default async function MorePage() {
  const { t, profile } = await requireOwner();
  const items: { href: string; label: string; sub: string; icon: LucideIcon }[] = [
    { href: "/app/electricity", label: t("Electricity", "Bijli"), sub: t("Main bill, meter readings, tenant charges", "Main bill, meter reading, tenant charges"), icon: Zap },
    { href: "/app/reminders", label: t("WhatsApp reminders", "WhatsApp reminders"), sub: t("Remind tenants about pending rent", "Baaki rent ka reminder bhejein"), icon: MessageCircle },
    { href: "/app/reports", label: t("Reports", "Reports"), sub: t("Collection and occupancy", "Collection aur occupancy"), icon: ChartColumn },
    { href: "/app/buildings", label: t("My buildings", "Meri buildings"), sub: t("Switch or add a building", "Building badlein ya jodein"), icon: Building2 },
    { href: "/app/notifications", label: t("Notifications", "Notifications"), sub: t("Approvals and announcements", "Approval aur announcements"), icon: Bell },
    { href: "/app/settings", label: t("Settings", "Settings"), sub: t("Profile, billing rules, language, support", "Profile, billing rules, bhasha, support"), icon: Settings },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("More", "More")} subtitle={profile.email} />
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map(({ href, label, sub, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3.5 px-4 py-3 hover:bg-slate-50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{label}</span>
                <span className="block truncate text-[0.82rem] text-slate-500">{sub}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <InstallCard
          title={t("Install HisabMitra on your phone", "HisabMitra phone mein install karein")}
          icon={<Download className="size-5" aria-hidden />}
        />
      </div>

      <div className="mt-4">
        <SignOutButton label={t("Logout", "Logout")} className="border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
