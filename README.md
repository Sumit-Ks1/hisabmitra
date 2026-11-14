# HisabMitra

> **PG ka hisaab, ab digital.**
> A simple, mobile-first PG & hostel management SaaS for India: rooms, tenants, monthly rent, electricity sub-meters, payments and reminders — installable as a PWA.

**Setup, deployment and the first-run test script: [docs/SETUP.md](docs/SETUP.md).**

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys etc. (see docs/SETUP.md)
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (the service worker only runs here) |
| `npm run typecheck` | Route-type generation + `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Vitest: business logic + the real SQL migrations on an in-process Postgres |
| `npm run icons` | Regenerate PWA icons from the logo |

---

## What is in the product

**Owner** — sign up (Google or email) → 4-step onboarding → price (rooms × per-room rate) → UPI QR + transaction reference → waits for approval → dashboard, rooms & beds, tenants & documents, allocation and swap, monthly bills, part payments, electricity readings and tenant-wise charges, reminders, reports, settings (Hinglish / English).

**Admin** — overview, searchable owner list, application review (verify payment, approve, reject with reason, request info, suspend, reactivate), limits and plans, pricing, UPI/support/integration settings, announcements, audit log.

### Status of external integrations

| Integration | Status | Without it |
| --- | --- | --- |
| Supabase (DB, auth, storage) | **Required** — add keys | App shows a "setup required" page |
| Google sign-in | Needs OAuth client in Supabase | Email/password still works |
| UPI subscription payment | Manual: QR + reference + admin verification | — |
| WhatsApp (Meta Cloud API) | Code complete; **off until credentials + approved template** | Copy message / open in WhatsApp |
| Electricity bill fetch (BBPS / Setu) | Interface + sandbox adapter done; **live adapter deliberately not wired** (needs onboarding and biller metadata) | Owner types in the bill; sandbox mode for testing |
| Email notifications | Not built (in-app notifications only) | — |

The sandbox electricity adapter returns made-up bills and is labelled as such on every screen. Nothing in the app reports a message as sent, a bill as paid or an account as approved unless the server confirmed it.

---

## Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, Cache Components, Server Actions, `proxy.ts` |
| UI | React 19, Tailwind CSS v4, shadcn-style components on Radix, lucide icons, sonner |
| Forms | React Hook Form + Zod (same schemas on client and server) |
| Data | Supabase Postgres + Auth + Storage via `@supabase/ssr` |
| Charts | Recharts (one chart, on Reports) |
| PWA | Hand-written service worker (`/sw.js` route), manifest, install prompt, offline page |
| Tests | Vitest + PGlite (runs `supabase/migrations/*.sql` for real) |

```
supabase/migrations/     0001 core · 0002 property · 0003 billing · 0004 electricity & WhatsApp
                         0005 onboarding & admin · 0006 RLS & grants · 0007 storage
src/
  proxy.ts               Session refresh + first-line route guard
  app/
    (marketing)/         Public site — fully static (ensureStatic)
    (auth)/              login, signup, forgot / reset password
    auth/callback/       OAuth + email-link landing
    onboarding/          wizard → payment → status
    app/                 Owner app (home, tenants, rooms, payments, electricity, reminders, reports, settings…)
    admin/               Admin panel
    api/                 cron (daily, whatsapp) + WhatsApp webhook
    sw.js/ manifest.ts offline/   PWA
  components/
    ui/                  button, input, card, dialog, action-form (form ↔ Server Action glue)
    app/                 shell, nav, payment dialog, tenant form, documents, charges review, reminders…
    onboarding/ auth/ pwa/ sections/ layout/ branding/
  lib/
    auth/session.ts      getSession · requireOwner · requireAdmin (role always read from the DB)
    actions/             Server Actions, each wrapped in userAction / ownerAction / adminAction
    data/                Server-side read helpers (workspace, rooms, reminders, settings, admin)
    billing/proration.ts Pure proration maths (mirrors the SQL)
    electricity/         Provider interface, mock + Setu adapters, allocation maths
    whatsapp/            Message building, eligibility, Cloud API client, queue worker
    uploads/             Upload rules, content sniffing, client-side optimise / combine-to-PDF
    validation.ts        Zod schemas
    i18n/                t("English", "Hinglish") helper
tests/
  db/                    harness (PGlite + Supabase shim), security, billing
  unit/                  proration (incl. parity with SQL), pricing, UPI, allocation, WhatsApp, uploads
```

### Where the important rules live

Rules that must hold even if someone bypasses the UI are in the **database**:

- **Tenant isolation** — RLS on every table (`owner_id = auth.uid()`), plus composite foreign keys so a row cannot reference another owner's building.
- **No self-promotion** — role, account status, limits, prices and payment verification are not writable through the API; only `SECURITY DEFINER` functions that check the caller change them, and each writes the audit log.
- **No double allocation** — partial unique indexes: one active allocation per bed and per tenant. Swap and move run in one transaction and only ever close old rows and add new ones.
- **No duplicate bills** — `unique (tenant_id, period_month)`; `ensure_billing` is idempotent and safe to call on every app open and from cron.
- **No duplicate payments** — idempotency key per submission + unique transaction reference per building. Payments are voided with a reason, never edited or deleted.
- **Bill is "paid" only after a successful payment row** — set by trigger, never by the client.

The admin can read account-level data (owners, buildings, subscriptions, payment proofs) but not tenants, tenant documents or tenant ledgers.

### Billing model in one paragraph

Each building has a billing day. On or after it, every active tenant gets one invoice for the period with a rent line (prorated for a mid-period join or exit by the building's rule — calendar days, 30-day month, full month — or a custom first-month amount with a reason). Electricity is added as one line when the owner confirms the month's charges; other charges and discounts are manual lines. Payments are separate rows applied to the chosen invoice first, then oldest dues; any excess is kept as advance and applied automatically to the next invoice. Outstanding = all invoices − all payments − unused advance, so opening the app mid-month always shows the right number. Deposits are tracked separately from rent.

---

## Branding

The mark (house + check + "digital" dot) lives in `src/components/branding/logo.tsx`; the favicon, Apple icon, OG image and PWA icons all use the same geometry. Colours and shadows are tokens in `src/app/globals.css`.

No testimonials, statistics or affiliations are shown anywhere — the dashboard picture on the landing page is labelled as an illustration.
