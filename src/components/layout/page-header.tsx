import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";

/** Header band for inner pages (About, Contact, Privacy, Terms). */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200/70 pb-14 pt-32 sm:pb-16 sm:pt-40">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-radial absolute inset-0" />
        <div className="absolute left-1/2 top-[-14rem] h-[28rem] w-[48rem] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(124_143_255/0.22),transparent)]" />
      </div>
      <Container size="narrow">
        <Badge>{eyebrow}</Badge>
        <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-ink sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 text-pretty text-lg leading-relaxed text-slate-600">{description}</p>
        )}
        {meta && <p className="mt-6 text-sm text-slate-500">{meta}</p>}
      </Container>
    </section>
  );
}
