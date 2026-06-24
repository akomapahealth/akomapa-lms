import type { Metadata, Viewport } from "next";
import { Outfit, Fraunces } from "next/font/google";
// NOTE: do NOT import "@uploadthing/react/styles.css" here. It bundles its
// own minified Tailwind subset whose un-scoped `.hidden{display:none}` loads
// after our utilities and overrides every responsive `md:flex`/`lg:flex`
// (it's what made the app sidebar disappear). `withUt` in tailwind.config.ts
// already generates the styles UploadThing needs.
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/providers/toaster-provider";
import { ConfettiProvider } from "@/components/providers/confetti-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { siteConfig } from "@/lib/site-config";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.organization, url: siteConfig.organizationUrl }],
  creator: siteConfig.organization,
  publisher: siteConfig.organization,
  alternates: {
    canonical: "/",
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1920,
        height: 1080,
        alt: "Akomapa student leaders providing community health care",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#111820" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" suppressHydrationWarning>
        <body className={`${outfit.variable} ${fraunces.variable} font-sans`}>
          <ThemeProvider>
            <ConfettiProvider />
            <ToastProvider />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
