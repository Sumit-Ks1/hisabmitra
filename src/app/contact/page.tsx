import type { Metadata } from "next";
import { Handshake, MessageSquareText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ContactDetails } from "@/components/sections/contact-section";
import { Container } from "@/components/ui/container";

const description =
  "Get in touch with HisabMitra — the upcoming PG and hostel management platform for India.";

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact", title: "Contact HisabMitra", description },
};

const TOPICS = [
  {
    icon: MessageSquareText,
    title: "Tell us about your PG",
    body: "How do you track tenants, rent and bills today? What slows you down?",
  },
  {
    icon: Sparkles,
    title: "Feedback on planned features",
    body: "Tell us what matters most to you so we can prioritise it.",
  },
  {
    icon: Handshake,
    title: "Business & partnership enquiries",
    body: "Payment, banking and technology partners are welcome to reach out.",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Have a PG? Let's connect."
        description="We're building HisabMitra for PG owners and accommodation operators. We'd love to hear from you."
      />
      <Container size="narrow" className="py-16 sm:py-20">
        <ContactDetails />

        <h2 className="mt-14 text-lg font-semibold tracking-tight text-ink">What you can write to us about</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {TOPICS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
              <Icon className="size-5 text-brand-600" strokeWidth={1.8} aria-hidden />
              <p className="mt-3 text-[0.95rem] font-semibold text-ink">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm leading-relaxed text-slate-500">
          Please don&apos;t send tenant documents or other sensitive personal information by email.
          HisabMitra is not yet live and cannot process tenant records or payments.
        </p>
      </Container>
    </>
  );
}
