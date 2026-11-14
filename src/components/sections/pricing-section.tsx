import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSettings } from "@/lib/data/settings";
import { inr } from "@/lib/format";
import { durationLabel, estimateSubscription } from "@/lib/pricing";

const EXAMPLES = [10, 20, 30, 40, 50];

const INCLUDED = [
  "Tenants, rooms and beds",
  "Monthly rent bills and payment records",
  "Sub-meter readings and electricity charges",
  "Reminder messages for WhatsApp",
  "Reports",
  "Works like an app on your phone",
];

/** Reads the price from admin settings (cached; refreshed when the admin changes it). */
export async function PricingSection() {
  const { pricing } = await getPublicSettings();
  const per = durationLabel(pricing.duration_months);

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading id="pricing-title" eyebrow="Pricing" title="Simple pricing. Pay per room." description="No setup fee. No per-tenant charge. One building per subscription." />

        <div className="reveal mx-auto mt-12 grid max-w-4xl gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-6 shadow-lift sm:p-8">
            <p className="text-sm font-medium text-slate-500">Per room</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-[-0.04em] text-ink">{inr(pricing.price_per_room)}</span>
              <span className="text-slate-500">/ room / month</span>
            </p>
            {pricing.discount_percent > 0 && <p className="mt-2 text-sm font-medium text-success-700">{pricing.discount_percent}% off right now</p>}
            {pricing.duration_months > 1 && <p className="mt-2 text-sm text-slate-500">Billed for {per} at a time.</p>}
            <ul className="mt-6 grid gap-2.5">
              {INCLUDED.map((x) => (
                <li key={x} className="flex items-start gap-2.5 text-[0.95rem] text-slate-700">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
            <ButtonLink href="/signup" size="lg" className="mt-7 w-full">
              Start Managing Your PG
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
            <p className="mt-3 text-center text-[0.8rem] text-slate-500">Pay by UPI. Your account is activated after our team verifies the payment.</p>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-6 shadow-soft sm:p-8">
            <p className="text-sm font-semibold text-ink">What will I pay?</p>
            <table className="mt-4 w-full text-left text-[0.95rem]">
              <thead>
                <tr className="border-b border-slate-200 text-[0.78rem] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="pb-2 font-semibold">Rooms</th>
                  <th scope="col" className="pb-2 text-right font-semibold">For {per}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {EXAMPLES.map((rooms) => (
                  <tr key={rooms}>
                    <td className="py-3 text-slate-700">{rooms} rooms</td>
                    <td className="py-3 text-right font-semibold text-ink">{inr(estimateSubscription(rooms, pricing))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[0.82rem] leading-relaxed text-slate-500">
              Have more than one building? Sign up with your first building and contact us — we will raise your limit.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
