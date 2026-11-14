import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config";
import { BRAND, LEGAL_LAST_UPDATED, LEGAL_LAST_UPDATED_ISO } from "@/lib/constants";

const description = "Terms of service for HisabMitra, the PG and hostel management app.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms", title: "Terms of Service · HisabMitra", description },
};

export default function TermsPage() {
  const email = siteConfig.contactEmail;

  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="These terms govern your use of the HisabMitra website and app."
        meta={
          <>
            Last updated: <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED}</time>
          </>
        }
      />
      <Container size="narrow" className="py-16 sm:py-20">
        <div className="prose-hm">
          <h2>1. Acceptance</h2>
          <p>By creating an account or using HisabMitra you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>.</p>

          <h2>2. The service</h2>
          <p>
            HisabMitra is a record-keeping tool for PG and hostel owners: rooms, tenants, rent bills, payments received,
            electricity charges and reminders. It is an accounting aid. HisabMitra does not collect rent from tenants,
            hold money for owners or tenants, or act as a payment intermediary between them.
          </p>

          <h2>3. Accounts and approval</h2>
          <ul>
            <li>You must give accurate information and keep your login secure. You are responsible for activity in your account.</li>
            <li>New accounts are reviewed before activation. We may ask for more information, or decline or suspend an account, for example where details cannot be verified or the service is misused.</li>
          </ul>

          <h2>4. Subscription and payment</h2>
          <ul>
            <li>The price is shown before you pay and depends on the number of rooms and the subscription period. One subscription covers one building unless we agree otherwise.</li>
            <li>Payment is made by UPI to the details shown in the app. Submitting a transaction reference is not proof of payment; access starts only after we verify that the payment was received.</li>
            <li>When a subscription expires, access may be limited until it is renewed. Your records are not deleted because of expiry alone.</li>
            <li>Refund requests are considered case by case — please contact us.</li>
          </ul>

          <h2>5. Your data and your tenants</h2>
          <p>
            You own the records you enter. You are responsible for having the right to record your tenants&rsquo;
            information, for obtaining their consent before storing identity documents or sending them WhatsApp messages,
            and for the accuracy of what you enter. Do not upload documents you are not entitled to hold.
          </p>

          <h2>6. Calculations</h2>
          <p>
            Rent, proration, late-fee and electricity calculations follow the rules and rates you choose and are shown to
            you before they are applied. Please review them. Electricity charges to tenants are your own arrangement with
            your tenants; the amount recovered may differ from the DISCOM bill.
          </p>

          <h2>7. Third-party integrations</h2>
          <ul>
            <li><strong>Electricity bills.</strong> Automatic bill fetch and bill payment work only where an authorised BBPS provider integration is active. Where it is not, the app says so and you can enter bills yourself. Any sandbox or test bill is labelled as such and is not a real bill.</li>
            <li><strong>WhatsApp.</strong> Automatic reminders use the official WhatsApp Business Platform and work only where it is connected. Delivery depends on WhatsApp and is not guaranteed.</li>
          </ul>
          <p>{BRAND.disclaimer}</p>

          <h2>8. Acceptable use</h2>
          <p>
            Do not use HisabMitra for anything unlawful, to send unsolicited or bulk messages, to try to access another
            customer&rsquo;s data, or to interfere with the service.
          </p>

          <h2>9. Availability</h2>
          <p>
            We work to keep HisabMitra available but do not promise uninterrupted service. The app needs an internet
            connection; an action is saved only when the app confirms it.
          </p>

          <h2>10. Liability</h2>
          <p>
            HisabMitra is provided &ldquo;as is&rdquo;. To the extent permitted by law, we are not liable for indirect or
            consequential losses, or for disputes between owners and tenants. Nothing in these terms limits liability that
            cannot be limited by law.
          </p>

          <h2>11. Ending the service</h2>
          <p>You may stop using HisabMitra at any time and ask us to delete your account. We may suspend or end access for breach of these terms.</p>

          <h2>12. Changes and governing law</h2>
          <p>
            We may update these terms; the date at the top shows the latest revision. These terms are governed by the laws
            of India.
          </p>

          <h2>13. Contact</h2>
          <p>
            {email ? (
              <>
                Questions about these terms: <a href={`mailto:${email}`}>{email}</a>.
              </>
            ) : (
              <>
                Questions about these terms can be sent through our <Link href="/contact">contact page</Link>.
              </>
            )}
          </p>
        </div>
      </Container>
    </>
  );
}
