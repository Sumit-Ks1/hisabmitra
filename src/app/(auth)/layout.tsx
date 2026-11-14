import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/branding/logo";
import { BRAND } from "@/lib/constants";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate flex flex-1 flex-col items-center px-4 pb-10 pt-8 sm:justify-center sm:pt-10">
      <div aria-hidden className="bg-grid mask-radial absolute inset-0 -z-10" />
      <Link href="/" aria-label="HisabMitra — home" className="rounded-lg">
        <Logo />
      </Link>
      <p className="mt-2 text-sm text-slate-500">{BRAND.tagline}</p>
      <div className="mt-6 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-lift sm:p-7">{children}</div>
      <p className="mt-6 max-w-md text-center text-[0.8rem] leading-relaxed text-slate-500">
        By continuing you agree to our{" "}
        <Link href="/terms" className="font-medium text-slate-700 underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-slate-700 underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
