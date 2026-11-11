import { ArrowRight, BedDouble, ChartColumn, ReceiptIndianRupee, Users, Zap } from "lucide-react";
import { LOGO_GEOMETRY } from "@/components/branding/logo";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const MODULES = [
  { icon: Users, label: "Tenants" },
  { icon: BedDouble, label: "Rooms & beds" },
  { icon: ReceiptIndianRupee, label: "Rent" },
  { icon: Zap, label: "Electricity" },
  { icon: ChartColumn, label: "Reports" },
];

export function LaunchSection() {
  return (
    <section
      id="launch"
      aria-labelledby="launch-title"
      className="relative isolate overflow-hidden bg-ink py-24 text-white sm:py-32"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid-dark absolute inset-0 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[56rem] max-w-[180vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(79_110_247/0.38),transparent)]" />
        {/* Oversized brand house outline */}
        <svg
          viewBox="8 9 24 24"
          className="absolute -bottom-24 -right-16 h-[26rem] w-[26rem] text-white/[0.04] sm:-right-10"
        >
          <path d={LOGO_GEOMETRY.house} fill="none" stroke="currentColor" strokeWidth="0.35" />
          <path d={LOGO_GEOMETRY.check} fill="none" stroke="currentColor" strokeWidth="0.35" />
        </svg>
      </div>

      <Container className="flex flex-col items-center text-center">
        <Badge tone="dark" className="reveal">
          <span className="size-1.5 rounded-full bg-warm-400 motion-safe:animate-pulse" aria-hidden />
          Coming soon
        </Badge>

        <h2
          id="launch-title"
          className="reveal mt-7 max-w-3xl text-balance text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl"
        >
          PG management ka <span className="text-brand-400">naya chapter</span> shuru hone wala hai.
        </h2>

        <p className="reveal mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
          Say goodbye to scattered registers and confusing spreadsheets. A smarter way to manage your
          PG is coming.
        </p>

        <ul className="reveal mt-10 flex max-w-2xl flex-wrap justify-center gap-2" aria-label="Planned modules">
          {MODULES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[0.8rem] text-slate-300"
            >
              <Icon className="size-3.5 text-brand-300" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <div className="reveal mt-10">
          <ButtonLink href="#contact" variant="light" size="lg">
            Stay Tuned
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
