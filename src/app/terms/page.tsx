import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";
import { BRAND, LEGAL_LAST_UPDATED, LEGAL_LAST_UPDATED_ISO } from "@/lib/constants";

const description =
  "Terms of use for the HisabMitra pre-launch website. Planned features are not yet available.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms", title: "Terms of Service · HisabMitra", description },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="These terms govern your use of the HisabMitra pre-launch website."
        meta={
          <>
            Last updated: <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED}</time>
          </>
        }
      />
      <Container size="narrow" className="py-16 sm:py-20">
        <div className="prose-hm">
          <h2>1. About these terms</h2>
          <p>
            By accessing or using this website, you agree to these terms. If you do not agree, please
            do not use the website.
          </p>

          <h2>2. Pre-launch status</h2>
          <p>
            HisabMitra is an upcoming PG and hostel management platform that is currently in
            development. This website is informational only. <strong>No HisabMitra product or service
            is currently offered or operated through it</strong> — there are no accounts, no tenant
            management tools, and no payment, bill-payment or collection services available.
          </p>

          <h2>3. Planned features</h2>
          <p>
            Features described on this website are <strong>planned</strong> and are not yet available.
            They describe what HisabMitra intends to build and may change, be delayed, or not be
            released. Nothing on this website is a commitment to provide any particular feature,
            integration or launch date. Any future integrations — including electricity bill or payment
            integrations — will depend on availability and on any necessary third-party approvals and
            authorizations.
          </p>

          <h2>4. Illustrative content</h2>
          <p>
            Product previews, dashboard mock-ups, names and figures shown on this website are
            illustrations using fictional sample data. They do not represent real people, properties,
            customers or results.
          </p>

          <h2>5. No affiliation</h2>
          <p>{BRAND.disclaimer}</p>

          <h2>6. No professional advice</h2>
          <p>
            Content on this website is general information about a software product. It is not legal,
            financial, tax or accounting advice.
          </p>

          <h2>7. Intellectual property</h2>
          <p>
            The HisabMitra name, logo, design and content on this website are the property of
            HisabMitra and may not be copied or reused without permission, except as allowed by law.
          </p>

          <h2>8. Acceptable use</h2>
          <p>
            You agree not to misuse this website — for example, by attempting to disrupt it, gain
            unauthorized access to it, or use it for any unlawful purpose.
          </p>

          <h2>9. External links</h2>
          <p>
            Links to third-party websites are provided for convenience. We are not responsible for
            their content or practices.
          </p>

          <h2>10. Disclaimer and limitation of liability</h2>
          <p>
            This website is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
            warranties of any kind. To the fullest extent permitted by applicable law, HisabMitra is not
            liable for any loss arising from your use of, or reliance on, this website.
          </p>

          <h2>11. Governing law</h2>
          <p>These terms are governed by the laws of India.</p>

          <h2>12. Changes</h2>
          <p>
            We may update these terms from time to time. The &ldquo;Last updated&rdquo; date above shows
            the latest revision. Separate terms will apply to the HisabMitra product when it launches.
          </p>

          <h2>13. Contact</h2>
          <p>
            Questions about these terms can be sent through our <Link href="/contact">contact page</Link>.
            See also our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </Container>
    </>
  );
}
