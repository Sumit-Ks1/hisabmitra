"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import type { NavLink } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches) close();
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onResize);
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-slate-900/5"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full px-4 pb-4 pt-2 sm:px-6"
      >
        <nav
          aria-label="Mobile"
          className={cn(
            "overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-lift",
            open && "motion-safe:animate-fade-up",
          )}
          style={{ animationDuration: "0.25s" }}
        >
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => close()}
                  className="flex min-h-12 items-center rounded-xl px-4 text-[0.95rem] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 p-2 pt-3">
            <Link href="/login" onClick={() => close()} className="flex h-12 items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-ink">
              Login
            </Link>
            <Link href="/signup" onClick={() => close()} className="flex h-12 items-center justify-center rounded-xl bg-ink text-sm font-medium text-white">
              Sign up
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
