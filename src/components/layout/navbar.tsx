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

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.04] hover:text-ink">
            Login
          </Link>
          <Link href="/signup" className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[0.8rem] font-medium text-white transition-colors hover:bg-ink-2">
            Sign up
          </Link>
        </div>

        <MobileMenu links={NAV_LINKS} />
      </Container>
    </ScrollHeader>
  );
}
