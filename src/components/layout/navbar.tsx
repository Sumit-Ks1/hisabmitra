import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { Container } from "@/components/ui/container";
import { NAV_LINKS } from "@/lib/constants";
import { MobileMenu } from "./mobile-menu";
import { ScrollHeader } from "./scroll-header";

export function Navbar() {
  return (
    <ScrollHeader>
      <Container className="relative flex h-16 items-center justify-between gap-6 md:h-[4.25rem]">
        <Link href="/" aria-label="HisabMitra — home" className="rounded-lg">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-900/[0.04] hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:block">
          <Link
            href="/#launch"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-ink pl-3 pr-4 text-[0.8rem] font-medium text-white transition-colors hover:bg-ink-2"
          >
            <span className="relative flex size-2" aria-hidden>
              <span className="size-2 rounded-full bg-success-500 motion-safe:animate-pulse-dot" />
            </span>
            Coming Soon
          </Link>
        </div>

        <MobileMenu links={NAV_LINKS} />
      </Container>
    </ScrollHeader>
  );
}
