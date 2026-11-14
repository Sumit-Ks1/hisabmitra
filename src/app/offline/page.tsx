import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/branding/logo";
import { ReloadButton } from "@/components/pwa/reload-button";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
export const ensureStatic = "navigation";

/** Shown by the service worker when a page cannot be loaded. Contains no user data. */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <LogoMark className="size-12" title="HisabMitra" />
      <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-ink">Internet nahi hai</h1>
      <p className="mt-2 max-w-sm text-slate-600">You are offline. HisabMitra needs internet to show and save your PG records.</p>
      <p className="mt-2 max-w-sm text-[0.92rem] text-slate-500">
        Jo kaam aapne offline kiya woh save nahi hua hai. Internet aane par dobara karein.
      </p>
      <ReloadButton />
    </main>
  );
}
