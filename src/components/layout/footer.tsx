import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/branding/logo";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config";
import { BRAND, FOOTER_LINKS } from "@/lib/constants";

export function Footer() {
  const { contactEmail, socials } = siteConfig;

  return (
    <footer className="relative bg-ink text-slate-400">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Link href="/" aria-label="HisabMitra — home" className="inline-block rounded-lg">
              <Logo variant="dark" />
            </Link>
            <p className="mt-5 text-lg font-medium tracking-tight text-white">{BRAND.tagline}</p>
            <p className="mt-2 text-sm leading-relaxed">{BRAND.shortDescription}</p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-slate-300">
              <span className="size-1.5 rounded-full bg-warm-400" aria-hidden />
              Made for PG owners in India
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_LINKS.map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-slate-200">
                  {group.heading}
                </p>
                <ul className="mt-4 space-y-1">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex min-h-9 items-center text-sm transition-colors hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            {(contactEmail || socials.length > 0) && (
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-slate-200">
                  Reach us
                </p>
                <ul className="mt-4 space-y-1">
                  {contactEmail && (
                    <li>
                      <a
                        href={`mailto:${contactEmail}`}
                        className="inline-flex min-h-9 items-center break-all text-sm transition-colors hover:text-white"
                      >
                        Email
                      </a>
                    </li>
                  )}
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 text-sm transition-colors hover:text-white"
                      >
                        {s.label}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}
