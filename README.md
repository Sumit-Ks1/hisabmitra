# HisabMitra — Coming-Soon Website

> **PG ka hisaab, ab digital.**
> Marketing and pre-launch website for HisabMitra, an upcoming PG & hostel management platform for India.

This repository contains **only the public marketing website**. It has no dashboard, authentication,
database, payments, BBPS or electricity integrations — by design.

---

## Tech stack

| Layer      | Choice                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Cache Components, fully static output)         |
| Language   | TypeScript (strict)                                                    |
| Styling    | Tailwind CSS v4 (design tokens in `src/app/globals.css`)               |
| Icons      | lucide-react (rendered on the server — no icon JS shipped)             |
| Fonts      | Geist Sans / Geist Mono via `next/font` (self-hosted at build time)    |
| Motion     | CSS only (`animation-timeline: view()` reveals, respects reduced motion) |

Runtime dependencies are limited to `next`, `react`, `react-dom` and `lucide-react`.
Only two small client components exist (the scroll-aware header and the mobile menu).
The root layout exports `ensureStatic = "navigation"`, so the build **fails** if anything
ever introduces request-time server rendering — every page is prerendered.

---

## Project structure

```
src/
  app/
    layout.tsx            Root layout, global metadata, fonts, skip link
    page.tsx              Homepage (sections + Organization/WebSite JSON-LD)
    globals.css           Design tokens, textures, motion, long-form prose styles
    about/ contact/ privacy/ terms/   Inner pages
    not-found.tsx         Branded 404
    icon.svg              Favicon (same geometry as the logo)
    apple-icon.tsx        180×180 iOS icon (generated at build)
    opengraph-image.tsx   1200×630 social card (generated at build)
    twitter-image.tsx     Twitter card (reuses the OG image)
    sitemap.ts robots.ts  SEO routes
  components/
    branding/logo.tsx     LogoMark + Logo (light / dark / compact) + shared geometry
    layout/               navbar, scroll-header, mobile-menu, footer, page-header
    sections/             hero, trust-strip, problem, features, how-it-works,
                          audience, philosophy, launch, contact
    illustrations/        Hand-built SVG illustrations for the problem section
    ui/                   button, badge, container, section-heading,
                          feature-card, dashboard-preview
  lib/
    config.ts             Environment-driven site config (all optional, validated)
    constants.ts          Brand copy, nav links, legal dates
    utils.ts              `cn()` class joiner
```

---

## Branding

The mark is a **house carrying a checkmark** — a property whose records are in order — on a
brand-blue tile, with a warm dot as the "digital update" signal. All variants share one
geometry object (`LOGO_GEOMETRY` in `src/components/branding/logo.tsx`):

| Variant                 | Where / how                                      |
| ----------------------- | ------------------------------------------------ |
| Primary (light bg)      | `<Logo />` — ink "Hisab" + blue "Mitra"          |
| Dark-background         | `<Logo variant="dark" />` — used in the footer   |
| Compact icon            | `<Logo compact />` or `<LogoMark />`             |
| Favicon                 | `src/app/icon.svg`                               |
| Apple touch icon / OG   | `src/app/apple-icon.tsx`, `opengraph-image.tsx`  |

Palette: ink `#111827`, ink-2 `#1F2937`, brand `#4F6EF7` / `#7C8FFF`, success `#16A36A`,
warm `#F5C451`, canvas `#F8FAFC`. Darker brand/success shades (`brand-600/700`,
`success-700`) are used for text and buttons so they meet WCAG AA contrast.

---

## Local setup

Requirements: **Node.js 20.9+** and npm.

```bash
npm install
cp .env.example .env.local     # optional — fill in what you have
npm run dev                    # http://localhost:3000
```

Quality checks:

```bash
npx tsc --noEmit               # type check
npm run lint                   # ESLint (next/core-web-vitals + TypeScript)
npm run build                  # production build (all routes prerendered)
npm run start                  # serve the production build locally
```

---

## Environment variables

All are optional. Missing or invalid values are **hidden gracefully** — nothing is invented.

| Variable                    | Purpose                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`      | Canonical URL, e.g. `https://hisabmitra.in` (no trailing slash). Falls back to Vercel's production domain, then `http://localhost:3000`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Public business email — enables the mailto link in Contact, footer and JSON-LD.   |
| `NEXT_PUBLIC_INSTAGRAM_URL` | Instagram profile (`https://` only).                                              |
| `NEXT_PUBLIC_LINKEDIN_URL`  | LinkedIn page (`https://` only).                                                  |

`NEXT_PUBLIC_*` values are inlined at build time — **redeploy after changing them**.

---

## Deploying to Vercel (free tier)

1. Push this folder to a GitHub / GitLab / Bitbucket repository.
2. In Vercel, **Add New → Project** and import the repository. The Next.js preset is detected
   automatically; keep the default build command (`next build`) and output settings.
3. Under **Settings → Environment Variables**, add the variables above for the
   *Production* (and optionally *Preview*) environments.
4. Deploy. Because every route is static, the site is served from Vercel's CDN with
   negligible function usage.

Or with the CLI:

```bash
npm i -g vercel
vercel           # preview deployment
vercel --prod    # production deployment
```

---

## Domain configuration

Suggested setup (use whichever domain you actually register, e.g. `hisabmitra.in` or `hisabmitra.com`):

1. Vercel → Project → **Settings → Domains** → add both `hisabmitra.in` and `www.hisabmitra.in`.
2. Choose the apex (`hisabmitra.in`) as primary and let `www` redirect to it (or the reverse —
   just be consistent).
3. At your registrar, add the DNS records Vercel shows. Typically:
   - Apex: `A` record → `76.76.21.21`
   - `www`: `CNAME` → `cname.vercel-dns.com`

   Always use the exact values displayed in your Vercel dashboard, as they can change.
4. Set `NEXT_PUBLIC_SITE_URL` to the primary domain (e.g. `https://hisabmitra.in`) and redeploy so
   canonical tags, Open Graph URLs, `sitemap.xml` and `robots.txt` point to it.
5. HTTPS certificates are issued automatically by Vercel.
6. Optional: submit `https://<your-domain>/sitemap.xml` in Google Search Console.

For a business email on the same domain (recommended for BBPS / payment-gateway onboarding),
configure MX records with your email provider, then set `NEXT_PUBLIC_CONTACT_EMAIL`.

---

## Honesty guardrails

- Every feature is labelled **Planned feature**; a note states that none are live.
- The hero dashboard is labelled **Illustrative product preview** and uses fictional data
  ("Demo Residency"), with internally consistent numbers.
- No testimonials, partner logos, user counts, countdowns, signup forms or rating schema.
- About and Terms pages state that HisabMitra is not affiliated with any government DISCOM, UPPCL, PVVNL, NPCI or BBPS.
- Privacy policy accurately states: no forms, no analytics, no cookies of its own, fonts self-hosted.
