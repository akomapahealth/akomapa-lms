/**
 * Single source of truth for site-wide brand + SEO metadata.
 *
 * The canonical URL resolves in priority order so it is correct in every
 * environment without hardcoding a domain:
 *   1. NEXT_PUBLIC_SITE_URL        — explicit override (set this in prod)
 *   2. VERCEL_PROJECT_PRODUCTION_URL — auto-provided by Vercel in production
 *   3. NEXT_PUBLIC_APP_URL          — existing app URL (localhost in dev)
 *   4. http://localhost:3000        — final fallback
 */
const resolveSiteUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
};

export const siteConfig = {
  name: "Akomapa Academy",
  shortName: "Akomapa",
  title: "Akomapa Academy — Global Health Education & Leadership (GHELP)",
  description:
    "Empowering the next generation of health leaders through student-powered, expert-supervised learning. Ten courses, measured growth, and verifiable certificates. Nya Akomapa, have a good heart.",
  url: resolveSiteUrl(),
  ogImage: "/landing/hero-poster.jpg",
  locale: "en_US",
  organization: "Akomapa Health Foundation",
  organizationUrl: "https://www.akomapa.org",
  keywords: [
    "Akomapa Academy",
    "GHELP",
    "global health education",
    "health leadership",
    "medical education",
    "student-led healthcare",
    "community health",
    "health professional training",
    "nonprofit health education",
    "verifiable certificates",
  ],
} as const;

export type SiteConfig = typeof siteConfig;
