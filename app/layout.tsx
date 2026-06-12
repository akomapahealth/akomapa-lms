import type { Metadata } from "next";
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

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Akomapa Academy",
  description: "Empowering the next generation of health leaders through student-powered, expert-supervised learning. Training future healthcare professionals to transform communities.",
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
