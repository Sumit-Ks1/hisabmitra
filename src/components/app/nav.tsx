"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BedDouble,
  Building2,
  ChartColumn,
  ClipboardList,
  Home,
  IndianRupee,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTransition } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { switchBuildingAction } from "@/lib/actions/workspace";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home, tenants: Users, rooms: BedDouble, payments: IndianRupee, more: Menu, electricity: Zap,
  reminders: MessageCircle, reports: ChartColumn, buildings: Building2, settings: Settings, bell: Bell,
  overview: LayoutGrid, owners: ShieldCheck, pricing: Tag, audit: ClipboardList, global: SlidersHorizontal,
} satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // "More" is active for every page that is not one of the other four tabs
  const others = items.slice(0, -1);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item, i) => {
          const Icon = ICONS[item.icon];
          const active = i === items.length - 1 ? !others.some((o) => isActive(pathname, o)) : isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-medium",
                  active ? "text-brand-700" : "text-slate-500",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-brand-50")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function BuildingSwitcher({ buildings, current }: { buildings: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const t = useT();
  if (buildings.length <= 1) {
    return <p className="truncate text-[0.95rem] font-semibold text-ink">{buildings[0]?.name}</p>;
  }
  return (
    <label className="block min-w-0">
      <span className="sr-only">{t("Building", "Building")}</span>
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await switchBuildingAction(e.target.value);
            router.refresh();
          })
        }
        className="h-10 w-full max-w-[14rem] truncate rounded-xl border border-slate-200 bg-white px-3 text-[0.92rem] font-semibold text-ink"
      >
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SignOutButton({ className, label }: { className?: string; label: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={cn(
          "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium text-slate-600 hover:bg-slate-100 hover:text-ink",
          className,
        )}
      >
        <LogOut className="size-5" aria-hidden />
        {label}
      </button>
    </form>
  );
}
