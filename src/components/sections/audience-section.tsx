import { BriefcaseBusiness, Building2, Hotel, House, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const AUDIENCES: { icon: LucideIcon; title: string; context: string; benefits: string[] }[] = [
  {
    icon: House,
    title: "Individual PG Owners",
    context: "Running a single PG — often handling everything yourself.",
    benefits: [
      "Replace the rent register with a clear monthly view",
      "See pending dues at a glance",
      "Keep tenant details and documents in one place",
    ],
  },
  {
    icon: Hotel,
    title: "Hostel Operators",
    context: "Higher bed counts and frequent check-ins and check-outs.",
    benefits: [
      "Bed-level inventory and vacancy tracking",
      "Smoother onboarding for new residents",
      "Room-wise listings for daily operations",
    ],
  },
  {
    icon: Building2,
    title: "Multi-Property Owners",
    context: "Several PGs across one city — or more.",
    benefits: [
      "Switch between properties from one dashboard",
      "Compare occupancy and collections",
      "Consolidated monthly summaries",
    ],
  },
  {
    icon: BriefcaseBusiness,
    title: "Property Managers",
    context: "Managing day-to-day operations on behalf of owners.",
    benefits: [
      "Organized records that are easy to share",
      "Clear payment history and receipts",
      "Electricity and expenses tracked per property",
    ],
  },
];

export function AudienceSection() {
  return (
    <section
      id="who-its-for"
      aria-labelledby="audience-title"
      className="border-y border-slate-200/70 bg-white py-20 sm:py-28"
    >
      <Container>
        <SectionHeading
          id="audience-title"
          eyebrow="Who it's for"
          title="Built for every kind of PG owner."
          description="Whether you run one PG with twelve beds or manage several properties, HisabMitra is being shaped around how Indian accommodation businesses actually work."
        />

        <ul className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-16 xl:grid-cols-4 xl:gap-5">
          {AUDIENCES.map(({ icon: Icon, title, context, benefits }) => (
            <li
              key={title}
              className="reveal group flex flex-col rounded-[1.25rem] border border-slate-200/80 bg-canvas p-6 transition-colors duration-300 hover:border-brand-200 hover:bg-white"
            >
              <span className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink shadow-soft transition-colors group-hover:border-brand-200 group-hover:text-brand-600">
                <Icon className="size-5" strokeWidth={1.8} aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{title}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-slate-500">{context}</p>
              <ul className="mt-5 space-y-2.5 border-t border-slate-200/80 pt-5">
                {benefits.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[0.9rem] leading-snug text-slate-700">
                    <span aria-hidden className="mt-[0.45rem] h-px w-3 shrink-0 bg-brand-400" />
                    {b}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
