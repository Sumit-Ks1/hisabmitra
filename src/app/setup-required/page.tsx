import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Logo } from "@/components/branding/logo";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Setup required", robots: { index: false } };

/** Shown instead of the app when the server has no Supabase configuration. */
export default function SetupRequiredPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <Link href="/" aria-label="HisabMitra — home">
        <Logo />
      </Link>
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-warm-50 text-warm-800">
        <Settings className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-ink">Setup required</h1>
      <p className="mt-3 max-w-md text-slate-600">
        The app is not connected to its database yet. The site administrator needs to add the Supabase project URL and
        key to the server environment (see <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">docs/SETUP.md</code>).
      </p>
      <p className="mt-2 max-w-md text-slate-500">App abhi database se connect nahi hai. Thodi der baad dobara try karein.</p>
      <LinkButton href="/" variant="outline" className="mt-8">
        Back to home
      </LinkButton>
    </main>
  );
}
