import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Renders only the contact channels that are actually configured. */
export function ContactDetails({ className }: { className?: string }) {
  const { contactEmail, socials } = siteConfig;
  const hasAny = Boolean(contactEmail) || socials.length > 0;

  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-slate-200/80 bg-white p-6 shadow-lift sm:p-8",
        className,
      )}
    >
      {contactEmail ? (
        <a
          href={`mailto:${contactEmail}?subject=${encodeURIComponent("Hello HisabMitra")}`}
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-canvas p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50 sm:p-5"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Mail className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.78rem] font-medium text-slate-500">Email us</span>
            <span className="block break-all text-base font-semibold text-ink sm:text-lg">
              {contactEmail}
            </span>
          </span>
          <ArrowUpRight
            className="size-5 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600"
            aria-hidden
          />
        </a>
      ) : (
        <div className="flex items-start gap-4 rounded-2xl border border-dashed border-slate-300 bg-canvas p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <MessageCircle className="size-5" aria-hidden />
          </span>
          <p className="text-[0.95rem] leading-relaxed text-slate-600">
            Already a customer? Open the app and go to Settings → Support for our phone and email.
          </p>
        </div>
      )}

      {socials.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[0.8rem] text-slate-500">Follow along</span>
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {s.label}
              <ArrowUpRight className="size-3.5 text-slate-400" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </div>
      )}

      {hasAny && (
        <p className="mt-5 text-[0.8rem] leading-relaxed text-slate-500">
          PG owners, hostel operators and prospective partners are all welcome to write in.
        </p>
      )}
    </div>
  );
}

export function ContactSection() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <SectionHeading
            id="contact-title"
            align="left"
            eyebrow="Contact"
            title="Have a PG? Let's connect."
            description="We're building HisabMitra for PG owners and accommodation operators. We'd love to hear from you."
          />
          <ContactDetails className="reveal" />
        </div>
      </Container>
    </section>
  );
}
