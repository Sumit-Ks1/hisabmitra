import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config";
import { LEGAL_LAST_UPDATED, LEGAL_LAST_UPDATED_ISO } from "@/lib/constants";

const description =
  "Privacy policy for the HisabMitra pre-launch website — what this site does and does not collect.";

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
        description="HisabMitra is a pre-launch product. This policy explains, in plain language, how this marketing website handles information."
        meta={
          <>
            Last updated: <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED}</time>
          </>
        }
      />
      <Container size="narrow" className="py-16 sm:py-20">
        <div className="prose-hm">
          <h2>1. About this website</h2>
          <p>
            This website introduces HisabMitra, an upcoming PG and hostel management platform
            (&ldquo;HisabMitra&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). It is an informational,
            pre-launch marketing website only. The HisabMitra product itself is not yet available, and
            this policy covers this website alone.
          </p>

          <h2>2. What this website does not do</h2>
          <ul>
            <li>It has no user accounts, sign-up, login or contact forms.</li>
            <li>It does not collect tenant information, documents or any property records.</li>
            <li>It does not accept or process payments of any kind.</li>
            <li>It does not use analytics, advertising or tracking tools.</li>
            <li>It does not set cookies of its own.</li>
          </ul>

          <h2>3. Information processed when you visit</h2>
          <p>
            Like any website, this site is delivered by a hosting provider. To deliver pages and keep
            the service secure, the hosting provider&apos;s infrastructure may automatically process
            standard technical information such as your IP address, browser type, the page requested
            and the time of the request. We do not use this information to identify or profile
            visitors.
          </p>
          <p>
            Fonts and other assets are served from this website itself; your browser is not asked to
            load them from third-party font or content services.
          </p>

          <h2>4. If you email us</h2>
          <p>
            {email ? (
              <>
                If you choose to write to us at <a href={`mailto:${email}`}>{email}</a>, we will receive
                your email address and whatever you include in your message.
              </>
            ) : (
              <>
                If you choose to email us once our contact address is published, we will receive your
                email address and whatever you include in your message.
              </>
            )}{" "}
            We use this only to read and reply to your message. We do not sell it or share it for
            marketing, and we keep it only for as long as needed for that correspondence. Please do not
            send tenant documents or other sensitive personal information by email.
          </p>

          <h2>5. Links to other websites</h2>
          <p>
            This site may link to external websites, such as our social media pages where configured.
            Those websites have their own privacy practices, which we do not control.
          </p>

          <h2>6. Children</h2>
          <p>This website is intended for business owners and operators and is not directed at children.</p>

          <h2>7. Your choices</h2>
          <p>
            You can ask us to delete any email correspondence you have sent us by writing to us at the
            contact address listed on our <Link href="/contact">contact page</Link>.
          </p>

          <h2>8. When HisabMitra launches</h2>
          <p>
            When the HisabMitra product becomes available, it will be accompanied by its own privacy
            policy explaining how product data is handled. This policy does not cover the future product.
          </p>

          <h2>9. Changes to this policy</h2>
          <p>
            We may update this policy as the website or product evolves. The &ldquo;Last updated&rdquo;
            date above shows when it was last revised.
          </p>
        </div>
      </Container>
    </>
  );
}
