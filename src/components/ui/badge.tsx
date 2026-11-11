import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "neutral" | "success" | "warm" | "dark";

const tones: Record<Tone, string> = {
  brand: "border-brand-200 bg-brand-50 text-brand-700",
  neutral: "border-slate-200 bg-white text-slate-600",
  success: "border-success-500/20 bg-success-50 text-success-700",
  warm: "border-warm-400/40 bg-warm-50 text-warm-800",
  dark: "border-white/15 bg-white/5 text-white/80",
};

/** Small uppercase mono label — used for eyebrows and status tags. */
export function Badge({
  children,
  tone = "brand",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span aria-hidden className="relative flex size-1.5">
          <span className="size-1.5 rounded-full bg-current opacity-80" />
        </span>
      )}
      {children}
    </span>
  );
}
