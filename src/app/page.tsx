import { AudienceSection } from "@/components/sections/audience-section";
import { ContactSection } from "@/components/sections/contact-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { LaunchSection } from "@/components/sections/launch-section";
import { PhilosophySection } from "@/components/sections/philosophy-section";
import { ProblemSection } from "@/components/sections/problem-section";
import { TrustStrip } from "@/components/sections/trust-strip";
import { siteConfig } from "@/lib/config";
import { BRAND } from "@/lib/constants";

/** Plain organization/website facts only — no ratings, reviews or offers. */
function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: BRAND.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/icon.svg`,
        description: BRAND.shortDescription,
        ...(siteConfig.contactEmail ? { email: siteConfig.contactEmail } : {}),
        ...(siteConfig.socials.length ? { sameAs: siteConfig.socials.map((s) => s.href) } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: BRAND.name,
        description: BRAND.description,
        inLanguage: "en-IN",
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so the JSON can never close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorks />
      <AudienceSection />
      <PhilosophySection />
      <LaunchSection />
      <ContactSection />
    </>
  );
}
