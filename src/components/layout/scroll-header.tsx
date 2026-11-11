"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}
const getScrolled = () => window.scrollY > 8;
const getServerScrolled = () => false;

/** Fixed header shell that gains a frosted surface once the page scrolls. */
export function ScrollHeader({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, getScrolled, getServerScrolled);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-slate-200/70 bg-white/80 shadow-[0_1px_12px_-6px_rgb(17_24_39/0.12)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
