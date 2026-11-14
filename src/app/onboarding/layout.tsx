import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/branding/logo";
import { Skeleton } from "@/components/ui/card";
import { signOutAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Get started", robots: { index: false } };

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <Link href="/" aria-label="HisabMitra — home" className="rounded-lg">
          <Logo />
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="size-4" aria-hidden /> Logout
          </button>
        </form>
      </header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-6">
        <Suspense
          fallback={
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-72" />
              <Skeleton className="h-12" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
