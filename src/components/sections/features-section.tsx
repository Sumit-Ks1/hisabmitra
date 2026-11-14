import { BedDouble, ChartColumn, Info, MessagesSquare, ReceiptIndianRupee, Users, Zap } from "lucide-react";
import { Container } from "@/components/ui/container";
import { FeatureCard, type Feature } from "@/components/ui/feature-card";
import { SectionHeading } from "@/components/ui/section-heading";

const FEATURES: Feature[] = [
  {
    icon: Users,
    title: "Tenant Management",
    description: "Every tenant's details, room, rent and papers in one place.",
    capabilities: [
      "Add a tenant in under a minute",
      "Joining and vacating dates",
      "Room and bed allocation",
      "Private document storage (ID, agreement)",
      "Room, rent and electricity history",
      "Notes for each tenant",
    ],
  },
  {
    icon: ReceiptIndianRupee,
    title: "Monthly Rent Tracking",
    description: "Know exactly who has paid, who hasn't and how much is pending.",
    capabilities: [
      "Rent bills created automatically every month",
      "Part payments and multiple payments",
      "Cash, UPI and bank transfer records",
      "Fair first-month rent for mid-month joining",
      "Old dues carried forward",
      "Security deposit and advance records",
    ],
  },
  {
    icon: BedDouble,
    title: "Rooms & Beds",
    description: "See every floor, room and free bed at a glance.",
    capabilities: [
      "Floor-wise room view",
      "Multiple beds per room",
      "Available, partly filled and full rooms",
      "Room swap between two tenants",
      "Maintenance status",
      "Full allocation history",
    ],
  },
  {
    icon: Zap,
    title: "Electricity",
    description: "Sub-meter readings in, tenant-wise charges out.",
    tag: "Auto bill fetch needs approval",
    capabilities: [
      "Monthly sub-meter readings",
      "Units × your rate, calculated for you",
      "Equal or usage-based sharing",
      "Common-area charges",
      "Main bill vs. tenant recovery comparison",
      "Automatic DISCOM bill fetch via BBPS once provider access is approved",
    ],
  },
  {
    icon: MessagesSquare,
    title: "WhatsApp Reminders",
    description: "A clear, polite reminder with the full bill break-up.",
    tag: "Auto sending needs setup",
    capabilities: [
      "Ready-made reminder message for each tenant",
      "Copy or open in WhatsApp with one tap",
      "Only for tenants who have agreed",
      "Never sent to tenants with nothing due",
      "Automatic sending through the official WhatsApp Business API once it is connected",
    ],
  },
  {
    icon: ChartColumn,
    title: "Reports",
    description: "Simple numbers, no manual calculation.",
    capabilities: [
      "Collected vs. pending, month by month",
      "Bed occupancy",
      "Who owes the most",
      "Cash vs. UPI collection",
      "Deposits you are holding",
    ],
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative border-y border-slate-200/70 bg-white py-20 sm:py-28">
      <div aria-hidden className="bg-grid mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-80 opacity-60" />
      <Container className="relative">
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title="Everything your PG needs. One simple app."
          description="From adding your first tenant to closing the month's accounts — on your phone, in Hinglish or English."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} total={FEATURES.length} />
          ))}
        </div>

        <p className="reveal mx-auto mt-10 flex max-w-3xl items-start gap-3 rounded-xl border border-slate-200 bg-canvas px-4 py-3.5 text-[0.85rem] leading-relaxed text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <span>
            HisabMitra records rent and payments — it does not collect money from tenants. Automatic
            electricity bill fetch and automatic WhatsApp sending depend on third-party approvals;
            until they are active, the app gives you a manual option and tells you so.
          </span>
        </p>
      </Container>
    </section>
  );
}
