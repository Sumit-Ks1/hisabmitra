"use client";

import { CheckCircle2, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type Platform = "server" | "installed" | "ios" | "ios-other-browser" | "other";

function detect(): Platform {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (!ios) return "other";
  return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-other-browser" : "ios";
}
const noop = () => () => {};

/**
 * Install help that matches the device:
 *  - Android / desktop Chrome: a real "Install" button (when the browser offers one)
 *  - iPhone / iPad: Safari's Share → Add to Home Screen steps (iOS has no install prompt)
 */
export function InstallCard({ title, icon, tone = "light" }: { title: string; icon?: ReactNode; tone?: "light" | "plain" }) {
  const platform = useSyncExternalStore<Platform>(noop, detect, () => "server");
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (platform === "server") return null;
  const wrap = tone === "light" ? "rounded-2xl border border-slate-200 bg-white p-4 shadow-soft" : "";

  if (platform === "installed" || installed) {
    return (
      <div className={wrap}>
        <p className="flex items-center gap-2 text-[0.92rem] font-medium text-success-700">
          <CheckCircle2 className="size-5" aria-hidden /> App install ho chuka hai / App is installed
        </p>
      </div>
    );
  }

  return (
    <div className={wrap}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        {icon} {title}
      </p>
      {platform === "ios" && (
        <ol className="mt-3 space-y-2 text-[0.92rem] text-slate-700">
          <li className="flex items-center gap-2">
            1. Safari mein neeche <Share className="inline size-4 text-brand-600" aria-label="Share" /> <b>Share</b> dabayein
          </li>
          <li className="flex items-center gap-2">
            2. <SquarePlus className="inline size-4 text-brand-600" aria-hidden /> <b>Add to Home Screen</b> chunein
          </li>
          <li>3. <b>Add</b> dabayein — HisabMitra aapki home screen par aa jayega</li>
        </ol>
      )}
      {platform === "ios-other-browser" && (
        <p className="mt-2 text-[0.92rem] text-slate-700">
          iPhone par install karne ke liye is page ko <b>Safari</b> mein kholein, phir Share → <b>Add to Home Screen</b>.
        </p>
      )}
      {platform === "other" &&
        (event ? (
          <Button
            className="mt-3"
            onClick={async () => {
              await event.prompt();
              await event.userChoice;
              setEvent(null);
            }}
          >
            Install app
          </Button>
        ) : (
          <p className="mt-2 text-[0.92rem] text-slate-700">
            Chrome mein upar <b>⋮</b> menu kholein → <b>Install app</b> / <b>Add to Home screen</b> chunein.
          </p>
        ))}
    </div>
  );
}
