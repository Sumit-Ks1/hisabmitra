import { cn } from "@/lib/utils";

/**
 * HisabMitra mark — a property (house) carrying a checkmark: an organized,
 * verified record. The warm dot is the "digital" signal — a fresh update.
 *
 * Geometry is shared with `src/app/icon.svg` (favicon) and the generated
 * OG / Apple icons, so every surface renders the identical mark.
 */
export const LOGO_GEOMETRY = {
  viewBox: "0 0 40 40",
  tile: { rx: 11 },
  house:
    "M10.5 19.2 19.1 11.9a1.4 1.4 0 0 1 1.8 0l8.6 7.3a1.4 1.4 0 0 1 .5 1.1v8.3a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-8.3a1.4 1.4 0 0 1 .5-1.1Z",
  check: "M15.6 22.6 18.7 25.6 24.5 19.6",
  dot: { cx: 31, cy: 10, r: 2.6 },
  colors: { tile: "#4F6EF7", house: "#FFFFFF", check: "#3A52D6", dot: "#F5C451" },
} as const;

type MarkProps = {
  className?: string;
  /** Accessible title. Omit when the mark sits next to the visible wordmark. */
  title?: string;
};

export function LogoMark({ className, title }: MarkProps) {
  const g = LOGO_GEOMETRY;
  return (
    <svg
      viewBox={g.viewBox}
      className={cn("shrink-0", className ?? "size-8")}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <rect width="40" height="40" rx={g.tile.rx} fill={g.colors.tile} />
      {/* soft top highlight for depth */}
      <rect width="40" height="20" rx={g.tile.rx} fill="#FFFFFF" opacity="0.08" />
      <path d={g.house} fill={g.colors.house} />
      <path
        d={g.check}
        fill="none"
        stroke={g.colors.check}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r} fill={g.colors.dot} />
    </svg>
  );
}

type LogoProps = {
  /** `light` = for light backgrounds (ink wordmark). `dark` = for dark backgrounds. */
  variant?: "light" | "dark";
  /** Show only the compact icon. */
  compact?: boolean;
  className?: string;
  markClassName?: string;
};

export function Logo({ variant = "light", compact = false, className, markClassName }: LogoProps) {
  if (compact) return <LogoMark className={markClassName} title="HisabMitra" />;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span
        className={cn(
          "text-[1.15rem] font-semibold tracking-[-0.02em]",
          variant === "light" ? "text-ink" : "text-white",
        )}
      >
        Hisab
        <span className={variant === "light" ? "text-brand-600" : "text-brand-400"}>Mitra</span>
      </span>
    </span>
  );
}
