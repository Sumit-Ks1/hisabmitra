import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need a computer?",
    a: "No. HisabMitra is made for the phone. You can also open it on a laptop if you like — it is the same account.",
  },
  {
    q: "How do I pay for the subscription?",
    a: "During sign-up you see the amount for your number of rooms and a UPI QR code. Pay with any UPI app, enter the transaction ID, and our team verifies the payment — usually within 2–24 hours. Your account is activated after that.",
  },
  {
    q: "Does HisabMitra collect rent from my tenants?",
    a: "No. Tenants keep paying you the way they do today — cash, UPI or bank transfer. You record what you received, and HisabMitra keeps the account and shows what is pending.",
  },
  {
    q: "A tenant joined on the 16th. How is the first month's rent calculated?",
    a: "You choose: by days, full month, or an amount you type in. The app shows the calculation before you save, for example ₹8,000 × 15 ÷ 30 days = ₹4,000.",
  },
  {
    q: "Can HisabMitra fetch my electricity bill automatically?",
    a: "Automatic bill fetch works through BBPS and needs approved provider access, which is not active for every account yet. Until it is, you type in the bill amount yourself. Sub-meter readings and tenant-wise charges work either way.",
  },
  {
    q: "Will reminders go to tenants on WhatsApp automatically?",
    a: "Automatic sending uses the official WhatsApp Business API and is available once that is connected. Until then the app prepares each tenant's message and you send it from your own WhatsApp with one tap. Reminders are only for tenants who have agreed to receive them.",
  },
  {
    q: "Who can see my tenants' documents?",
    a: "Only you. Documents are stored privately and opened through links that expire in a minute. The HisabMitra admin panel has no access to your tenants, their documents or their payments. You can delete documents at any time.",
  },
  {
    q: "I have more than one PG building.",
    a: "One subscription covers one building. Sign up with your first building, then contact us and we will enable more buildings on your account. Each building keeps its own rooms, tenants and accounts.",
  },
  {
    q: "Is HisabMitra connected to UPPCL or any electricity company?",
    a: "No. HisabMitra is an independent product. It is not affiliated with any DISCOM, NPCI or BBPS.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-slate-200/70 bg-white py-20 sm:py-28">
      <Container size="narrow">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Sawaal? Jawaab yahan hain." description="Common questions from PG owners." />
        <div className="reveal mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-5 py-1 sm:px-6">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[1rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-5 text-[0.95rem] leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
