import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "dark" | "light" | "ghost-dark";
type Size = "md" | "lg";

const base =
  "group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[0_1px_0_0_rgb(255_255_255/0.18)_inset,0_8px_20px_-8px_rgb(67_97_238/0.7)] hover:bg-brand-700",
  secondary:
    "border border-slate-200 bg-white text-ink shadow-soft hover:border-slate-300 hover:bg-slate-50",
  dark: "bg-ink text-white hover:bg-ink-2",
  light: "bg-white text-ink shadow-soft hover:bg-brand-50",
  "ghost-dark": "border border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4.5 text-sm",
  lg: "h-12 px-6 text-[0.95rem]",
};

type ButtonLinkProps = {
  href: string;
  variant?: Variant;
  size?: Size;
} & Omit<ComponentPropsWithoutRef<"a">, "href">;

/**
 * Link styled as a button. Internal routes use next/link; external, mailto
 * and in-page hash links render a plain anchor.
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const isPlainAnchor = /^(https?:|mailto:|tel:|#)/.test(href);

  if (isPlainAnchor) return <a href={href} className={classes} {...props} />;
  return <Link href={href} className={classes} {...props} />;
}
