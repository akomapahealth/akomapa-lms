import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand/logo";
import { VerifyForm } from "./_components/verify-form";

export const metadata: Metadata = {
  title: "Verify a Certificate — Akomapa Academy",
  description:
    "Confirm the authenticity of any Akomapa Academy (GHELP) certificate by its certificate number.",
};

const VerifyIndexPage = () => {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-akomapa-gold/30 bg-card p-8 text-center shadow-soft">
        <Link href="/" className="inline-block" aria-label="Akomapa Academy home">
          <BrandMark size={56} className="mx-auto" />
        </Link>
        <h1 className="font-display mt-4 text-2xl font-semibold text-foreground">
          Verify a certificate
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a certificate number (e.g.{" "}
          <span className="font-mono">GHELP-2026-00042</span>) to confirm its
          authenticity.
        </p>
        <VerifyForm />
        <p className="mt-6 text-xs text-muted-foreground/70">
          Every Akomapa Academy certificate carries a unique, independently
          verifiable ID.
        </p>
      </div>
      <Link
        href="/"
        className="mt-6 text-sm text-muted-foreground transition hover:text-akomapa-teal"
      >
        ← Back to Akomapa Academy
      </Link>
    </div>
  );
};

export default VerifyIndexPage;
