import { ArrowDown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DashboardPreview } from "@/components/ui/dashboard-preview";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-28 sm:pt-36">
      {/* Background: soft grid, brand glow, warm accent — restrained */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-radial absolute inset-0" />
        <div className="absolute left-1/2 top-[-12rem] h-[34rem] w-[60rem] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(124_143_255/0.28),transparent)]" />
        <div className="absolute right-[8%] top-[18rem] h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgb(245_196_81/0.18),transparent)]" />
      </div>

      <Container className="flex flex-col items-center text-center">
        <div className="motion-safe:animate-fade-up">
          <Badge tone="neutral" className="bg-white/80 py-1.5 shadow-soft backdrop-blur">
            <span className="size-1.5 rounded-full bg-success-500 motion-safe:animate-pulse-dot" aria-hidden />
            Built for Indian PG owners · Coming soon
          </Badge>
        </div>

        <h1
          id="hero-title"
          className="mt-7 max-w-4xl text-balance text-[2.35rem] font-semibold leading-[1.04] tracking-[-0.045em] text-ink motion-safe:animate-fade-up min-[400px]:text-[2.6rem] sm:text-6xl lg:text-[4.5rem]"
          style={{ animationDelay: "80ms" }}
        >
          Ab PG ka <span className="text-brand-500">hisaab</span> kitaabon mein nahi.
          <span className="mt-1 block text-slate-400 sm:mt-2">
            Sab kuch{" "}
            <span className="relative whitespace-nowrap text-ink">
              ek jagah.
              <svg
                aria-hidden
                viewBox="0 0 220 14"
                preserveAspectRatio="none"
                className="absolute -bottom-1.5 left-0 h-2.5 w-full sm:-bottom-2 sm:h-3.5"
              >
                <path
                  d="M3 9.5C45 4 120 2.5 217 7.5"
                  fill="none"
                  stroke="#F5C451"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </span>
        </h1>

        <p
          className="mt-7 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 motion-safe:animate-fade-up sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          Tenants, rooms, monthly rent, electricity bills aur payments — manage your entire PG
          digitally, without maintaining physical registers.
        </p>

        <div
          className="mt-9 flex w-full flex-col items-stretch justify-center gap-3 motion-safe:animate-fade-up min-[420px]:w-auto min-[420px]:flex-row min-[420px]:items-center"
          style={{ animationDelay: "240ms" }}
        >
          <ButtonLink href="#launch" size="lg">
            Launching Soon
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </ButtonLink>
          <ButtonLink href="#features" size="lg" variant="secondary">
            Explore Features
            <ArrowDown className="size-4 text-slate-400 transition-transform group-hover:translate-y-0.5" aria-hidden />
          </ButtonLink>
        </div>

        <p
          className="mt-5 text-[0.8rem] text-slate-500 motion-safe:animate-fade-up"
          style={{ animationDelay: "300ms" }}
        >
          PG ka hisaab, ab digital — starting with Uttar Pradesh.
        </p>
      </Container>

      <Container className="relative mt-14 sm:mt-20">
        <div className="motion-safe:animate-fade-up" style={{ animationDelay: "380ms" }}>
          <DashboardPreview className="mx-auto max-w-[68rem]" />
        </div>
        {/* floor fade into the next section */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-28 bg-linear-to-t from-canvas to-transparent max-sm:hidden" />
      </Container>
    </section>
  );
}
