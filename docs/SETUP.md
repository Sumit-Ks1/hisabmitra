# HisabMitra — setup & deployment

Everything needed to take this repository from "cloned" to "live". Do the sections in order.
Nothing here asks you to put a secret in source code: secrets go in `.env.local` (git-ignored) or your host's environment settings.

Requirements: Node.js 22 (20 still works but Supabase's client warns about it), a Supabase project, and — for production — a host that runs Next.js.

---

## 1. Supabase project

1. Create a project at supabase.com (pick the Mumbai region, closest to your users).
2. **Apply the database.** Either:
   - **Supabase CLI** (recommended):
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - **or SQL editor:** open each file in `supabase/migrations/` in name order (`0001`, `0002`, …) and run it. Run each file once. When a new migration is added later, run just that file — **before** deploying the code that needs it.
3. **Keys.** Project Settings → API. Copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - publishable / anon key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - secret / service_role key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose)

What the migrations create: all tables, Row Level Security on every table, the billing / allocation / approval functions, four **private** storage buckets (`tenant-documents`, `payment-proofs`, `meter-photos`, `avatars`) and default settings (₹50 per room per month).

## 2. Authentication

Supabase → Authentication:

- **URL Configuration**
  - Site URL: your production URL (e.g. `https://hisabmitra.in`)
  - Redirect URLs: add `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback`
- **Providers → Email**: keep **Confirm email ON**. (The admin bootstrap only trusts a verified email.)
- **Providers → Google**:
  1. Google Cloud Console → APIs & Services → OAuth consent screen → configure (External).
  2. Credentials → Create OAuth client ID → Web application.
     - Authorised JavaScript origins: your site URL(s)
     - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
  3. Paste the Client ID and Client Secret into Supabase → Providers → Google → enable.
- **Same email, Google + password:** Supabase links identities that share a verified email into one user, so a person who signed up with Google and later uses email/password (or the reverse) keeps one account and one profile. Keep email confirmation on for this to be safe.
- **Emails:** Supabase's built-in mailer is for testing only (very low hourly limit). Before real users, set up custom SMTP in Authentication → Emails.

## 3. Admin account

1. Set `ADMIN_EMAIL=you@example.com` and `SUPABASE_SERVICE_ROLE_KEY` in the environment.
2. Sign up in the app with exactly that email and verify it (or use Google with that address).
3. On the first verified login the server promotes that one account to admin and sends you to `/admin`.

There is no other way to become admin: the role column cannot be written through the API, the bootstrap function is callable only with the service-role key, and it re-checks that the email is verified. To change the admin later, change `ADMIN_EMAIL` and log in with the new address; demote the old one in SQL (`update profiles set role = 'pg_owner' where email = '…'`).

Then, in **Admin → Settings**, enter your **UPI ID** and support contact. Until a UPI ID is saved, owners cannot reach the payment step.

## 4. Run locally

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm run lint
npm test          # 100+ tests, incl. the real migrations on an in-process Postgres
npm run build
```

The service worker only registers in production builds (`npm run build && npm start`).

## 5. Deploy

Any Next.js host works (Vercel is the simplest). Add every variable from `.env.example` in the host's environment settings, then deploy.

**Hosting plans — check before going live** (verified November 2026; confirm on the linked pages):

- **Vercel Hobby is for personal, non-commercial use only.** A paid SaaS must be on Pro (or another host). Hobby cron jobs also run at most once a day with loose timing. — https://vercel.com/docs/limits/fair-use-guidelines , https://vercel.com/docs/cron-jobs/usage-and-pricing
- **Supabase Free** pauses a project after about a week without activity and has small limits (≈500 MB database, 1 GB file storage). Fine for development; use Pro for production so the project is never paused and you get backups. — https://supabase.com/pricing

**Scheduled jobs.** `vercel.json` schedules `/api/cron/daily` once a day (01:00 IST). It expires subscriptions, creates the month's bills for every building and retries queued WhatsApp messages. It requires `CRON_SECRET`. If you enable automatic WhatsApp sending and want faster retries, call `/api/cron/whatsapp` every few minutes from any scheduler with the header `Authorization: Bearer <CRON_SECRET>`.

**Custom domain.** Point the domain at your host, set `NEXT_PUBLIC_SITE_URL`, and update the Site URL / redirect URLs in Supabase (section 2) and the Google OAuth origins.

## 6. WhatsApp reminders (optional — needs Meta approval)

Until this is done the app shows "setup required" and gives owners **Copy message** / **Open in WhatsApp**. Nothing is ever marked as sent.

1. Meta Business account → create an app → add **WhatsApp** → register a business phone number.
2. Create a **Utility** template (WhatsApp Manager → Message templates), language English, body exactly:

   ```
   Namaste {{1}} ji,

   {{2}} ka PG bill:

   Room: {{3}}
   Rent: {{4}}
   Electricity: {{5}}
   Other charges: {{6}}
   Total: {{7}}
   Paid: {{8}}
   Remaining: {{9}}

   Kripya remaining amount jama kar dein.
   ```

   Wait for approval.
3. Create a permanent access token (System User token with `whatsapp_business_messaging`).
4. Environment: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`.
5. Delivery receipts (optional): set `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; in Meta → WhatsApp → Configuration set the webhook to `https://<your-domain>/api/whatsapp/webhook`, the same verify token, and subscribe to `messages`.
6. **Admin → Settings → WhatsApp reminders → Live.**

Rules the app enforces: only tenants recorded as having agreed, only valid Indian mobile numbers, only tenants who owe something, at most one reminder per tenant per month per day.

Note: the template shows the business's own number as sender for all PGs. Per-PG sender numbers would need each owner to onboard their own WhatsApp Business number — not built.

## 7. Electricity bill fetch via BBPS (optional — needs provider onboarding)

Three modes, chosen in **Admin → Settings**:

| Mode | What owners see |
|---|---|
| Off (default) | They type in the DISCOM bill amount. Everything else (sub-meters, tenant charges) works. |
| Sandbox | **Fake** bills from `MockElectricityProvider`, labelled "SANDBOX — not a real bill" everywhere. For testing the fetch → pay → status screens. No money moves. Do not leave on for real customers. |
| Live | Real bills through the BBPS provider — only if the server has provider credentials and biller details; otherwise it behaves like Off. |

Sandbox scenarios are picked by the **last digit of the consumer number**: `0` no bill, `9` provider error, `1` payment stays pending, `2` payment fails, `3` payment status unknown, anything else succeeds.

**Going live with Setu BillPay** is not done, on purpose: it needs BillPay (COU/agent) onboarding, production credentials, and each DISCOM's biller ID and customer-parameter name from Setu's catalogue. None of that can be guessed. When you have it:

1. Set `SETU_BILLPAY_BASE_URL`, `SETU_BILLPAY_CLIENT_ID`, `SETU_BILLPAY_CLIENT_SECRET`, `SETU_BILLPAY_BILLER_MAP`.
2. Implement the four `TODO(setu)` methods in `src/lib/electricity/setu-provider.ts` against Setu's current API reference. The rest of the app already talks to the `ElectricityProvider` interface (`src/lib/electricity/types.ts`), so nothing else changes.
3. Switch the admin setting to Live.

## 8. First-run test script

1. `/signup` → create an owner account → verify email → you land on onboarding.
2. Fill the 4 steps → see the price (rooms × ₹50) → UPI QR → enter any reference like `TEST12345678` → status screen.
3. Log out. Log in as the admin → **Owners** → open the owner → **Verify payment** → **Approve owner**.
4. Log in as the owner → dashboard. **Rooms → Quick setup** (e.g. 2 floors × 4 rooms × 2 beds).
5. **Tenants → Add**: set joining date to the 16th and watch the first-month calculation. Save.
6. **Payments**: record a part payment, then another. Check the balance. Try the same UPI reference twice — it is refused.
7. **Rooms → Swap rooms** with two tenants; check **Room history** on a tenant.
8. **Electricity → Meter readings**: set the rate once at the top, enter a reading for a room with a tenant → the electricity line appears on that tenant's bill at once (tenant page → overview shows rent + electricity = total due). Enter another reading a few days later → it continues from the last one and adds only the new units. Try a lower number or an earlier date (refused); use **Fix** / delete on the last reading.
9. **Reminders**: preview a message, copy it.
10. Create a second owner and confirm they see none of the first owner's data.
11. `npm run build && npm start`, open in Chrome → install the app → turn off the network → reload → offline page.

## 9. Security notes

- Every table has Row Level Security; owners are isolated by `owner_id`, and composite foreign keys stop a row from pointing at another owner's building even if RLS were misconfigured. `tests/db/security.test.ts` attacks this from a second owner's session.
- Price, account status, limits, roles and payment verification can only be changed by database functions that check the caller; the browser cannot write them.
- The service-role key is used only in server code (`src/lib/supabase/server.ts` → `createAdminClient`), after the caller has been authorised.
- Tenant documents: private bucket, server-chosen file paths, file type verified from the file's content, 60-second signed links.
- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and WhatsApp tokens if they are ever exposed.

Not yet done, worth doing before scale: an independent security review, automated database backups verification, and a legal review of `/privacy` and `/terms` (they are written in plain language but are not legal advice).
