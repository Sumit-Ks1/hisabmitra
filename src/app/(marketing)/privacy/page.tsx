import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config";
import { LEGAL_LAST_UPDATED, LEGAL_LAST_UPDATED_ISO } from "@/lib/constants";

const description = "How HisabMitra handles the information of PG owners and their tenants — what is collected, why, and how to delete it.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy", title: "Privacy Policy · HisabMitra", description },
};

export default function PrivacyPage() {
  const email = siteConfig.contactEmail;

  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="In plain language: what HisabMitra stores, why, who can see it, and how you stay in control."
        meta={
          <>
            Last updated: <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED}</time>
          </>
        }
      />
      <Container size="narrow" className="py-16 sm:py-20">
        <div className="prose-hm">
          <h2>1. Who this policy covers</h2>
          <p>
            HisabMitra (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a PG and hostel management app for property owners
            (&ldquo;owners&rdquo;). Owners use it to keep records about their own tenants. This policy covers this website
            and the HisabMitra app.
          </p>

          <h2>2. Information we collect</h2>
          <h3>From owners</h3>
          <ul>
            <li>Account details: name, email address, phone / WhatsApp number, language preference and an optional photo.</li>
            <li>Property details: PG name, address, number of floors, rooms and beds, and the electricity connection (DISCOM, consumer number, meter number).</li>
            <li>Subscription payment details you submit: the UPI transaction reference, payment date and an optional screenshot.</li>
          </ul>
          <h3>About tenants (entered by the owner)</h3>
          <ul>
            <li>Name, phone / WhatsApp number, joining and vacating dates, room and bed, rent, deposit, payments and dues.</li>
            <li>Optional details the owner chooses to add: email, emergency contact, occupation, notes.</li>
            <li>Optional documents the owner uploads, such as ID proof or a rent agreement.</li>
            <li>Whether the tenant has agreed to receive WhatsApp reminders.</li>
          </ul>
          <p>
            We do not ask for, read or store Aadhaar numbers as data. If an owner uploads an Aadhaar card as a document,
            it is stored as a private file like any other document.
          </p>

          <h2>3. How the information is used</h2>
          <ul>
            <li>To run the service: rooms, tenants, bills, payments, electricity charges and reports.</li>
            <li>To review and activate owner accounts and verify subscription payments.</li>
            <li>To send in-app notifications about your account.</li>
            <li>To send rent reminders to tenants on WhatsApp — only when the owner asks, and only to tenants recorded as having agreed.</li>
          </ul>
          <p>We do not sell personal information and we do not use tenant data for advertising.</p>

          <h2>4. Who can see what</h2>
          <ul>
            <li>An owner can see only their own buildings, tenants, documents and accounts. This separation is enforced in the database for every request, not just on screen.</li>
            <li>Our admin panel shows owner account details, building details and subscription payments so that we can approve and support accounts. It does not show tenant records, tenant documents or tenant payments.</li>
            <li>Tenant documents are kept in private storage and are opened only through links that expire within a minute.</li>
          </ul>

          <h2>5. Service providers</h2>
          <p>We rely on a small number of providers to run HisabMitra. They process data on our behalf:</p>
          <ul>
            <li><strong>Supabase</strong> — database, sign-in and private file storage.</li>
            <li><strong>Our hosting provider</strong> — serves the website and app.</li>
            <li><strong>Google</strong> — only if you choose &ldquo;Continue with Google&rdquo; to sign in.</li>
            <li><strong>Meta (WhatsApp Business Platform)</strong> — only where WhatsApp reminders are enabled; the tenant&rsquo;s phone number and the reminder text are sent to deliver the message.</li>
            <li><strong>A BBPS bill-payment provider</strong> — only where electricity bill fetch is enabled; the DISCOM and consumer number are sent to fetch the bill.</li>
          </ul>

          <h2>6. Cookies and device storage</h2>
          <p>
            We use only the cookies needed to keep you signed in and to remember which building you have open. We do not
            use advertising or cross-site tracking cookies. The installed app stores its own design files on your device
            so it opens faster; it does not store tenant records, documents or account data on the device.
          </p>

          <h2>7. Keeping and deleting information</h2>
          <ul>
            <li>Owners can delete any tenant document at any time, and can delete all documents of a tenant in one step. Deleted files are removed from storage.</li>
            <li>Financial records (bills and payments) are kept while the account is active, because they are the owner&rsquo;s accounts. A payment entered by mistake is marked cancelled rather than erased, so the history stays honest.</li>
            <li>To close an account and have its data deleted, contact us. We delete it unless we are required by law to keep something.</li>
          </ul>

          <h2>8. The owner&rsquo;s responsibilities</h2>
          <p>
            Owners decide what tenant information to record and are responsible for having a lawful reason to do so —
            including telling tenants what is recorded and obtaining their agreement before storing identity documents or
            sending WhatsApp messages. The app asks the owner to confirm this before the first document upload.
          </p>

          <h2>9. Tenants</h2>
          <p>
            If you are a tenant and want to see, correct or remove information a PG owner holds about you in HisabMitra,
            please ask your PG owner first. If that does not resolve it, contact us and we will help.
          </p>

          <h2>10. Security</h2>
          <p>
            Data is encrypted in transit. Access is limited by database-level rules, files are private by default, and
            sensitive administrative actions are logged. No system is perfectly secure; if we learn of a breach affecting
            your data we will inform you as required by law.
          </p>

          <h2>11. Changes</h2>
          <p>We may update this policy as the product changes. The date at the top shows the latest revision.</p>

          <h2>12. Contact</h2>
          <p>
            {email ? (
              <>
                Questions about privacy: <a href={`mailto:${email}`}>{email}</a>.
              </>
            ) : (
              <>
                Questions about privacy can be sent through our <Link href="/contact">contact page</Link>.
              </>
            )}
          </p>
        </div>
      </Container>
    </>
  );
}
