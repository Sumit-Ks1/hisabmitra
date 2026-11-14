import type { Metadata } from "next";
import { ArrowRight, Building2, FileX2, MapPin, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { BRAND } from "@/lib/constants";

const description =
  "Why HisabMitra was built — a simple app to help Indian PG and hostel owners move from paper registers to one organized digital dashboard.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: { url: "/about", title: "About HisabMitra", description },
};

const GLANCE = [
  { icon: Building2, label: "What", value: "PG & hostel management platform" },
  { icon: MapPin, label: "Where", value: "India, starting with Uttar Pradesh" },
  { icon: FileX2, label: "Replaces", value: "Registers, notebooks & loose spreadsheets" },
  { icon: ShieldCheck, label: "Status", value: "Live · new accounts are reviewed" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About HisabMitra"
        title={
          <>
            From physical registers to <span className="text-brand-500">smart digital management.</span>
          </>
        }
        description="HisabMitra is a software platform designed to help PG owners and accommodation operators in India run their properties with clarity — without the paperwork."
      />

      <Container size="narrow" className="py-16 sm:py-20">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GLANCE.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
                <dd className="mt-0.5 text-[0.95rem] font-medium text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="prose-hm mt-14">
          <h2>What HisabMitra is</h2>
          <p>
            HisabMitra is a PG management platform. Its goal is to bring the
            everyday work of running a paying-guest accommodation — tenants, rooms and beds, monthly
            rent, security deposits, electricity bills and other expenses — into one centralized,
            easy-to-use dashboard.
          </p>
          <p>
            The name says it simply: <strong>hisab</strong> (accounts) and <strong>mitra</strong>{" "}
            (friend). A friendly, dependable companion for keeping your PG&apos;s records in order.
          </p>

          <h2>Why it is being built</h2>
          <p>
            Across India, a large share of PGs and hostels are still managed with handwritten
            registers, notebooks, phone notes and scattered spreadsheets. That works when a property is
            small, but it gets harder with every new tenant, room and month.
          </p>
          <p>
            HisabMitra is being built so PG owners can spend less time reconciling records and more
            time running and growing their business.
          </p>

          <h2>The problem it aims to solve</h2>
          <ul>
            <li>Tenant details, documents and room assignments spread across notebooks and phones.</li>
            <li>No clear, instant answer to &ldquo;who has paid this month, and who hasn&apos;t?&rdquo;</li>
            <li>Electricity bills and utility expenses tracked separately — and split by hand.</li>
            <li>Little visibility into occupancy, vacancies and monthly income, especially across more than one property.</li>
          </ul>

          <h2>Focused on PG operations in India</h2>
          <p>
            HisabMitra is designed around how Indian accommodation businesses actually work —
            room- and bed-level sharing, monthly rent cycles, security deposits, shared electricity
            meters, and owners who manage one property or several. The initial focus is on PG owners
            in Uttar Pradesh, with the intention to serve operators across India.
          </p>

          <h2>Where things stand today</h2>
          <p>
            HisabMitra is open to PG owners. New accounts are reviewed by our team before they are
            activated. Rent tracking, room and tenant management, sub-meter readings and reports work
            today. Automatic electricity bill fetch (through BBPS) and automatic WhatsApp reminders
            depend on third-party approvals and are switched on only once those are in place; until
            then the app offers manual alternatives and says so clearly.
          </p>
          <p className="text-[0.9rem] text-slate-500">{BRAND.disclaimer}</p>
        </div>

        <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">Run a PG or hostel?</p>
            <p className="mt-1 text-sm text-slate-600">Set up your PG in a few minutes.</p>
          </div>
          <ButtonLink href="/signup" variant="dark">
            Start now <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
