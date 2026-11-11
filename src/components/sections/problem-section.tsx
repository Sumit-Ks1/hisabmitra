import type { ComponentType } from "react";
import {
  ElectricityIllustration,
  PaymentConfusionIllustration,
  RegisterIllustration,
  ScatteredIllustration,
} from "@/components/illustrations/problem-illustrations";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const PROBLEMS: { title: string; body: string; Art: ComponentType }[] = [
  {
    title: "Manual Tenant Records",
    body: "Tenant details, contact information, room assignments aur documents ko notebooks mein manage karna.",
    Art: RegisterIllustration,
  },
  {
    title: "Payment Confusion",
    body: "Kisne rent diya aur kiska payment pending hai, iska record maintain karna.",
    Art: PaymentConfusionIllustration,
  },
  {
    title: "Electricity & Expenses",
    body: "Monthly electricity bills aur other expenses ka hisaab alag-alag rakhna.",
    Art: ElectricityIllustration,
  },
  {
    title: "Scattered Information",
    body: "Rent records, tenant details aur property information multiple places par maintain karna.",
    Art: ScatteredIllustration,
  },
];

export function ProblemSection() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="problem-title"
          eyebrow="The everyday problem"
          title={
            <>
              PG chalana easy hai.{" "}
              <span className="text-slate-400">Uska hisaab rakhna nahi.</span>
            </>
          }
          description="Managing tenants, rent and daily expenses manually can quickly become confusing as your PG grows."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-5">
          {PROBLEMS.map(({ title, body, Art }, i) => (
            <li
              key={title}
              className="reveal group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft transition-shadow duration-300 hover:shadow-lift"
            >
              <div className="bg-dots relative flex h-40 items-center justify-center border-b border-slate-100 bg-canvas px-6">
                <span className="absolute left-4 top-3.5 font-mono text-[0.65rem] font-medium text-slate-400">
                  0{i + 1}
                </span>
                <div className="h-28 w-full max-w-[13rem] transition-transform duration-500 group-hover:-translate-y-0.5">
                  <Art />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
                <h3 className="text-[1.05rem] font-semibold tracking-tight text-ink">{title}</h3>
                <p className="text-[0.92rem] leading-relaxed text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
