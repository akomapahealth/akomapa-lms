import type { Metadata } from "next";

import { LegalDocument } from "@/app/(marketing)/_components/legal-document";
import { termsPage } from "@/lib/legal-content";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: termsPage.description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `Terms of Service | ${siteConfig.name}`,
    description: termsPage.description,
    url: "/terms",
  },
};

const TermsPage = () => {
  return <LegalDocument page={termsPage} />;
};

export default TermsPage;
