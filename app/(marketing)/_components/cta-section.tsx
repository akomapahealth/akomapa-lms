import Link from "next/link";

import { Button } from "@/components/ui/button";

import { SectionReveal } from "./section-reveal";

export const CtaSection = () => {
  return (
    <section className="bg-surface-deep py-24 text-surface-deep-foreground sm:py-32">
      <SectionReveal className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-gold">
          Nya Akomapa
        </p>
        <h2 className="font-display mt-6 text-balance text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
          Begin with a good heart.
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed opacity-80">
          Join student leaders across four countries learning to serve their
          communities — supervised by experts, measured by growth.
        </p>
        <Link href="/sign-up" className="mt-10">
          <Button
            size="lg"
            className="h-12 bg-akomapa-gold px-10 text-base font-semibold text-[hsl(187_80%_10%)] hover:bg-akomapa-gold/90"
          >
            Start the GHELP journey
          </Button>
        </Link>
      </SectionReveal>
    </section>
  );
};
