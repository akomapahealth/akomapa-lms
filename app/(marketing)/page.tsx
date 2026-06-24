import { siteConfig } from "@/lib/site-config";

import { CertificateTeaser } from "./_components/certificate-teaser";
import { CommunitySection } from "./_components/community-section";
import { CtaSection } from "./_components/cta-section";
import { Hero } from "./_components/hero";
import { JourneySection } from "./_components/journey-section";
import { MissionSection } from "./_components/mission-section";
import { OutcomesSection } from "./_components/outcomes-section";
import { StatsBand } from "./_components/stats-band";

// Homepage inherits the full default metadata (title, canonical, Open Graph)
// from the root layout via @/lib/site-config.

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "EducationalOrganization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
      logo: `${siteConfig.url}/android-chrome-512x512.png`,
      description: siteConfig.description,
      parentOrganization: {
        "@type": "NGO",
        name: siteConfig.organization,
        url: siteConfig.organizationUrl,
      },
      sameAs: [siteConfig.organizationUrl],
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: siteConfig.url,
      name: siteConfig.name,
      description: siteConfig.description,
      publisher: { "@id": `${siteConfig.url}/#organization` },
      inLanguage: "en",
    },
  ],
};

const LandingPage = () => {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <MissionSection />
      <StatsBand />
      <JourneySection />
      <OutcomesSection />
      <CommunitySection />
      <CertificateTeaser />
      <CtaSection />
    </main>
  );
};

export default LandingPage;
