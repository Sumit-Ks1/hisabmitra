import Link from "next/link";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/branding/logo";
import { Skeleton } from "@/components/ui/card";
import { BottomNav, SidebarNav, SignOutButton, type NavItem } from "./nav";

/**
 * App chrome shared by the owner app and the admin panel:
 * sidebar on desktop, top bar + bottom tabs on phones.
 */
export function AppShell({
  home,
  sidebar,
  bottom,
  title,
  bellHref,
  unread = 0,
  banner,
  signOutLabel,
  children,
}: {
  home: string;
  sidebar: NavItem[];
  bottom: NavItem[];
  /** the building switcher or a section title */
  title: ReactNode;
  bellHref?: string;
  unread?: number;
  banner?: ReactNode;
  signOutLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 bg-canvas">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <Link href={home} aria-label="HisabMitra" className="mb-6 rounded-lg px-1">
          <Logo />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav items={sidebar} />
        </div>
        <SignOutButton label={signOutLabel} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <Link href={home} aria-label="HisabMitra" className="rounded-lg lg:hidden">
            <LogoMark className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">{title}</div>
          {bellHref && (
            <Link
              href={bellHref}
              aria-label={unread > 0 ? `Notifications (${unread} new)` : "Notifications"}
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[0.62rem] font-bold leading-4 text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
        </header>
        {banner}
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav items={bottom} />
    </div>
  );
}

/** Static fallback rendered instantly while the session is checked. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1 bg-canvas">
      <aside className="hidden h-dvh w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
        <Logo />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <LogoMark className="size-8 lg:hidden" />
          <Skeleton className="h-6 w-40" />
        </div>
        <PageSkeleton />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-5 lg:px-8 lg:pt-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

/** Used by loading.tsx inside a shell: only the page area is a skeleton. */
export function ContentSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
