import { Container } from "@/components/ui/container";

const VALUES = [
  { lead: "Every tenant record,", end: "organized." },
  { lead: "Every payment,", end: "trackable." },
  { lead: "Every property,", end: "manageable." },
];

export function PhilosophySection() {
  return (
    <section aria-labelledby="philosophy-title" className="relative isolate overflow-hidden py-24 sm:py-32">
      {/* A faint register page — ruled lines and a margin — fading into clean space */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-ruled absolute inset-0 [mask-image:linear-gradient(to_right,black,transparent_65%)]" />
        <div className="absolute inset-y-0 left-[max(0.5rem,calc(50%-37.5rem))] w-px bg-warm-400/50 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" />
      </div>

      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
          <h2
            id="philosophy-title"
            className="reveal text-balance text-[2.6rem] font-semibold leading-[1] tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl"
          >
            Less paperwork.
            <br />
            <span className="text-brand-500">More control.</span>
          </h2>
          <p className="reveal max-w-md text-pretty text-lg leading-relaxed text-slate-600 lg:pb-2">
            Your time should go into growing your PG business, not searching through notebooks for
            last month&apos;s rent records.
          </p>
        </div>

        <ul className="mt-16 grid border-t border-slate-200 sm:mt-20 md:grid-cols-3">
          {VALUES.map(({ lead, end }, i) => (
            <li
              key={end}
              className="reveal flex flex-col gap-6 border-b border-slate-200 py-8 md:border-b-0 md:py-10 md:pr-8 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:pl-8"
            >
              <span className="font-mono text-xs text-slate-400">0{i + 1}</span>
              <p className="text-2xl font-medium leading-snug tracking-[-0.025em] text-slate-500 lg:text-[1.75rem]">
                {lead} <span className="text-ink">{end}</span>
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
