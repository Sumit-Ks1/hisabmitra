import {
  BedDouble,
  ChartColumn,
  Info,
  MessagesSquare,
  ReceiptIndianRupee,
  Users,
  Zap,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { FeatureCard, type Feature } from "@/components/ui/feature-card";
import { SectionHeading } from "@/components/ui/section-heading";

const FEATURES: Feature[] = [
  {
    icon: Users,
    title: "Complete Tenant Management",
    description: "Digitally manage every tenant from onboarding to checkout.",
    capabilities: [
      "Digital tenant onboarding",
      "Tenant profiles",
      "Contact information",
      "Tenant document records",
      "Check-in / check-out management",
      "Room and bed allocation",
      "Tenant status tracking",
    ],
  },
  {
    icon: ReceiptIndianRupee,
    title: "Monthly Rent Management",
    description: "Know exactly who has paid, who hasn't and how much is pending.",
    capabilities: [
      "Monthly rent records",
      "Paid / unpaid status",
      "Pending dues",
      "Payment history",
      "Security deposit records",
      "Rent receipts",
      "Payment reminders",
    ],
  },
  {
    icon: BedDouble,
    title: "Room & Occupancy Management",
    description: "Manage rooms, beds and availability across your PG properties.",
    capabilities: [
      "Multiple properties",
      "Room management",
      "Bed inventory",
      "Occupied / available beds",
      "Room-wise tenant listing",
      "Vacancy tracking",
    ],
  },
  {
    icon: Zap,
    title: "Electricity & Utility Management",
    description: "Keep electricity bills and monthly utility expenses organized.",
    capabilities: [
      "Monthly electricity bill records",
      "Utility expense tracking",
      "Tenant-wise charge allocation",
      "Monthly bill history",
      "Supported electricity bill integrations, subject to availability and authorization",
      "Consumption tracking wherever the utility provides the data",
    ],
  },
  {
    icon: ChartColumn,
    title: "Financial Reports & Analytics",
    description: "Understand your PG's financial performance without manual calculations.",
    capabilities: [
      "Monthly income",
      "Total rent collected",
      "Outstanding rent",
      "Electricity expenses",
      "Other operating expenses",
      "Monthly summaries",
      "Downloadable reports",
    ],
  },
  {
    icon: MessagesSquare,
    title: "Tenant Portal & Communication",
    description: "Give your tenants a simpler way to stay updated.",
    capabilities: [
      "Tenant-specific portal",
      "Monthly dues",
      "Payment history",
      "Rent receipts",
      "Announcements",
      "Maintenance requests",
      "Important notifications",
    ],
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="relative border-y border-slate-200/70 bg-white py-20 sm:py-28"
    >
      <div aria-hidden className="bg-grid mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60" />
      <Container className="relative">
        <SectionHeading
          id="features-title"
          eyebrow="What's coming"
          title="Everything your PG needs. One smart platform."
          description="From onboarding your first tenant to managing multiple properties, HisabMitra is being designed to simplify everyday PG operations."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} total={FEATURES.length} />
          ))}
        </div>

        <p className="reveal mx-auto mt-10 flex max-w-3xl items-start gap-3 rounded-xl border border-slate-200 bg-canvas px-4 py-3.5 text-[0.85rem] leading-relaxed text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <span>
            HisabMitra is in development and none of these features are live yet. Scope and timing may
            change before launch. Any bill-payment or utility integration will depend on availability
            and the necessary authorizations.
          </span>
        </p>
      </Container>
    </section>
  );
}
