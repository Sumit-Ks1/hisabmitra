import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Marketing link-button (pill shaped) — used by the landing pages    */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  App button (shadcn/ui pattern) — large touch targets for phones    */
/* ------------------------------------------------------------------ */
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-600 text-white hover:bg-brand-700",
        outline: "border border-slate-300 bg-white text-ink hover:bg-slate-50",
        soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
        ghost: "text-slate-700 hover:bg-slate-100",
        dark: "bg-ink text-white hover:bg-ink-2",
        success: "bg-success-500 text-white hover:bg-success-700",
        danger: "bg-danger-600 text-white hover:bg-danger-700",
        "danger-outline": "border border-danger-200 bg-white text-danger-700 hover:bg-danger-50",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[0.95rem]",
        lg: "h-12 px-5 text-base",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export type ButtonProps = ComponentPropsWithoutRef<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

type LinkButtonProps = Omit<ComponentPropsWithoutRef<typeof Link>, "className"> &
  VariantProps<typeof buttonVariants> & { className?: string };

/** next/link with app button styling. */
export function LinkButton({ className, variant, size, block, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
