import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  /** id for the heading so the parent <section> can use aria-labelledby */
  id?: string;
  tone?: "light" | "dark";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  id,
  tone = "light",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "reveal flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl items-start",
        className,
      )}
    >
      {eyebrow && <Badge tone={tone === "dark" ? "dark" : "brand"}>{eyebrow}</Badge>}
      <h2
        id={id}
        className={cn(
          "text-balance text-[1.85rem] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem]",
          tone === "light" ? "text-ink" : "text-white",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-pretty text-base leading-relaxed sm:text-lg",
            tone === "light" ? "text-slate-600" : "text-slate-300",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
