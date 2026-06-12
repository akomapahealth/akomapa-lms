import type { Metadata } from "next";

import { CertificateTeaser } from "./_components/certificate-teaser";
import { CommunitySection } from "./_components/community-section";
import { CtaSection } from "./_components/cta-section";
import { Hero } from "./_components/hero";
import { JourneySection } from "./_components/journey-section";
import { MissionSection } from "./_components/mission-section";
import { OutcomesSection } from "./_components/outcomes-section";
import { StatsBand } from "./_components/stats-band";

export const metadata: Metadata = {
  title: "Akomapa Academy — Global Health Education & Leadership (GHELP)",
  description:
    "Empowering the next generation of health leaders through student-powered, expert-supervised learning. Ten courses, measured growth, verifiable certificates. Nya Akomapa — have a good heart.",
  openGraph: {
    title: "Akomapa Academy — GHELP",
    description:
      "Student-powered, expert-supervised global health education. Begin with a good heart.",
    images: ["/landing/hero-poster.jpg"],
  },
};

const LandingPage = () => {
  return (
    <main>
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
