import Link from "next/link";

import { Button } from "@/components/ui/button";

// Placeholder landing page — replaced by the full marketing page in the
// next phase. Exists so `/` resolves publicly once proxy.ts opens it up.
const LandingPage = () => {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface-deep px-6 text-center text-surface-deep-foreground">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-akomapa-gold">
        Nya Akomapa — Have a good heart
      </p>
      <h1 className="font-display max-w-3xl text-4xl font-semibold md:text-6xl">
        Empowering the next generation of health leaders.
      </h1>
      <p className="max-w-xl text-base opacity-80">
        Student-powered, expert-supervised learning through the Akomapa Global
        Health Education &amp; Leadership Program (GHELP).
      </p>
      <div className="flex gap-3">
        <Link href="/sign-up">
          <Button size="lg" className="bg-akomapa-gold text-foreground hover:bg-akomapa-gold/90">
            Get started
          </Button>
        </Link>
        <Link href="/sign-in">
          <Button size="lg" variant="outline" className="border-surface-deep-foreground/40 bg-transparent text-surface-deep-foreground hover:bg-surface-deep-foreground/10">
            Sign in
          </Button>
        </Link>
      </div>
    </main>
  );
};

export default LandingPage;
