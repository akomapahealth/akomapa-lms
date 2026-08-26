import type { Metadata } from "next";

import { LegalDocument } from "@/app/(marketing)/_components/legal-document";
import { privacyPage } from "@/lib/legal-content";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: privacyPage.description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Privacy Policy | ${siteConfig.name}`,
    description: privacyPage.description,
    url: "/privacy",
  },
};

const PrivacyPage = () => {
  return <LegalDocument page={privacyPage} />;
};

export default PrivacyPage;
