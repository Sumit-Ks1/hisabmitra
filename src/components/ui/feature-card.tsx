import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  capabilities: string[];
  /** shown when part of the feature depends on an external approval */
  tag?: string;
};

export function FeatureCard({
  feature,
  index,
  total,
  className,
}: {
  feature: Feature;
  index: number;
  total: number;
  className?: string;
}) {
  const { icon: Icon, title, description, capabilities } = feature;
  const headingId = `feature-${index + 1}`;

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "reveal group relative flex flex-col rounded-[1.25rem] border border-slate-200/80 bg-white p-6 shadow-soft transition-[box-shadow,border-color] duration-300 hover:border-brand-200 hover:shadow-lift sm:p-7",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="relative flex size-12 items-center justify-center rounded-2xl bg-ink text-white shadow-[0_8px_20px_-10px_rgb(17_24_39/0.6)]">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden />
          <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-warm-400" aria-hidden />
        </span>
        {feature.tag && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-warm-400 bg-warm-50 px-2.5 py-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-warm-800">
            {feature.tag}
          </span>
        )}
      </div>

      <p className="mt-6 font-mono text-[0.68rem] text-slate-400">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h3 id={headingId} className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">{description}</p>

      <div className="mt-6 border-t border-slate-100 pt-5">
        <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-slate-400">
          What you can do
        </p>
        <ul className="grid gap-2.5">
          {capabilities.map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-[0.9rem] leading-snug text-slate-700">
              <span className="mt-[0.1rem] flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
