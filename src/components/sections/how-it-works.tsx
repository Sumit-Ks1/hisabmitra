import { Building2, Check, LayoutDashboard, UserPlus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

function PropertyVisual() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
        <span className="text-[0.72rem] text-slate-500">PG name</span>
        <span className="text-[0.75rem] font-semibold text-ink">Demo Residency</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Floors", "4"],
          ["Rooms", "20"],
          ["Beds", "50"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <p className="text-[0.62rem] text-slate-500">{k}</p>
            <p className="text-sm font-semibold text-ink tabular-nums">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TenantVisual() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-[0.7rem] font-semibold text-brand-700">
          KJ
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.78rem] font-semibold text-ink">Karan J.</span>
          <span className="block text-[0.65rem] text-slate-500">Check-in · 1 Nov</span>
        </span>
        <span className="rounded-full bg-success-50 px-2 py-0.5 text-[0.6rem] font-semibold text-success-700">Active</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[0.68rem]">
        <span className="text-slate-500">
          Room / bed <b className="block font-semibold text-ink">304 · Bed B</b>
        </span>
        <span className="text-slate-500">
          Monthly rent <b className="block font-semibold text-ink tabular-nums">₹6,750</b>
        </span>
      </div>
    </div>
  );
}

function ManageVisual() {
  return (
    <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-3">
      {[
        { k: "Rent collected", v: "75%", w: "w-3/4", c: "bg-success-500" },
        { k: "Beds occupied", v: "84%", w: "w-[84%]", c: "bg-brand-500" },
        { k: "Bills recorded", v: "4 / 4", w: "w-full", c: "bg-warm-400" },
      ].map((r) => (
        <div key={r.k}>
          <div className="mb-1 flex justify-between text-[0.66rem]">
            <span className="text-slate-500">{r.k}</span>
            <span className="font-semibold text-ink tabular-nums">{r.v}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${r.w} ${r.c}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

const STEPS: { n: string; icon: LucideIcon; title: string; body: string; visual: ReactNode }[] = [
  {
    n: "01",
    icon: Building2,
    title: "Set Up Your Property",
    body: "Create your PG profile, add rooms and configure available beds.",
    visual: <PropertyVisual />,
  },
  {
    n: "02",
    icon: UserPlus,
    title: "Onboard Your Tenants",
    body: "Add tenant details, assign rooms and configure monthly rent.",
    visual: <TenantVisual />,
  },
  {
    n: "03",
    icon: LayoutDashboard,
    title: "Manage Everything",
    body: "Track rent, pending payments, utility expenses and occupancy from one place.",
    visual: <ManageVisual />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow="How it will work"
          title={
            <>
              Your PG. Your Rules. <span className="text-brand-500">One Dashboard.</span>
            </>
          }
          description="Designed to make everyday PG management simpler."
        />

        <ol className="relative mt-14 grid gap-8 lg:mt-20 lg:grid-cols-3 lg:gap-6">
          {/* connector */}
          <div
            aria-hidden
            className="absolute bottom-10 left-5 top-5 w-px border-l border-dashed border-brand-300 lg:bottom-auto lg:left-[calc(100%/6)] lg:right-[calc(100%/6)] lg:top-5 lg:h-px lg:w-auto lg:border-l-0 lg:border-t"
          />
          {STEPS.map(({ n, icon: Icon, title, body, visual }) => (
            <li key={n} className="reveal relative pl-14 lg:pl-0 lg:pt-16">
              <span className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-full border border-brand-200 bg-white font-mono text-[0.72rem] font-semibold text-brand-700 shadow-soft ring-4 ring-canvas lg:left-1/2 lg:-translate-x-1/2">
                {n}
              </span>
              <div className="flex h-full flex-col rounded-[1.25rem] border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <Icon className="size-[1.05rem]" strokeWidth={1.8} aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight text-ink">
                    <span className="sr-only">Step {n}: </span>
                    {title}
                  </h3>
                </div>
                <p className="mt-3 text-[0.93rem] leading-relaxed text-slate-600">{body}</p>
                <div aria-hidden className="mt-5 rounded-xl bg-canvas p-3 ring-1 ring-slate-100">
                  {visual}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="reveal mt-10 text-balance text-center text-sm text-slate-500">
          <Check className="-mt-0.5 mr-1.5 inline size-4 text-success-500" aria-hidden />
          No registers. No scattered spreadsheets. Just one organized dashboard.
        </p>
      </Container>
    </section>
  );
}
