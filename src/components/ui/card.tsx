import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<"h2">) {
  return <h2 className={cn("text-base font-semibold text-ink", className)} {...props} />;
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="-ml-1 mb-1 inline-flex h-8 items-center gap-0.5 rounded-lg pr-2 text-sm font-medium text-slate-500 hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden /> Back
          </Link>
        )}
        <h1 className="truncate text-[1.4rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.92rem] text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "warm" | "danger";

const toneText: Record<Tone, string> = {
  neutral: "text-ink",
  brand: "text-brand-700",
  success: "text-success-700",
  warm: "text-warm-800",
  danger: "text-danger-700",
};
const toneIcon: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-50 text-success-700",
  warm: "bg-warm-50 text-warm-800",
  danger: "bg-danger-50 text-danger-700",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.82rem] font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneIcon[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className={cn("mt-1.5 text-[1.45rem] font-semibold leading-none tracking-[-0.02em] tabular-nums", toneText[tone])}>{value}</p>
      {hint && <p className="mt-1.5 text-[0.78rem] text-slate-500">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-slate-200 bg-white p-4 shadow-soft";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-brand-200")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const pillTones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warm: "bg-warm-50 text-warm-800",
  danger: "bg-danger-50 text-danger-700",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold", pillTones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[0.92rem] leading-relaxed text-slate-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "brand",
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const border: Record<Tone, string> = {
    neutral: "border-slate-200 bg-slate-50",
    brand: "border-brand-200 bg-brand-50",
    success: "border-success-500/25 bg-success-50",
    warm: "border-warm-400/50 bg-warm-50",
    danger: "border-danger-200 bg-danger-50",
  };
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4", border[tone], className)}>
      {Icon && <Icon className={cn("mt-0.5 size-5 shrink-0", toneText[tone])} aria-hidden />}
      <div className="min-w-0 text-[0.92rem] leading-relaxed text-slate-700">
        {title && <p className={cn("font-semibold", toneText[tone])}>{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

/** Key/value row used in summaries and detail screens. */
export function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2.5", className)}>
      <dt className="shrink-0 text-[0.9rem] text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[0.95rem] font-medium text-ink">{children}</dd>
    </div>
  );
}
