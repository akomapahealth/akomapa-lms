"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Award } from "lucide-react";

import { SectionReveal } from "./section-reveal";

export const CertificateTeaser = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-akomapa-ice/30 py-24 sm:py-32 dark:bg-card/40">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <SectionReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-teal">
            Verified achievement
          </p>
          <h2 className="font-display mt-6 text-pretty text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl">
            A certificate that stands up to scrutiny.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Every certificate carries your measured pre-to-post-test growth and
            a unique ID that anyone — an employer, a school, a scholarship
            committee — can verify in seconds. No PDFs taken on faith.
          </p>
          <Link
            href="/verify"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-akomapa-teal transition hover:gap-3"
          >
            Verify a certificate
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </SectionReveal>
        <SectionReveal delay={0.15}>
          <motion.div
            whileHover={reduceMotion ? undefined : { rotateX: 4, rotateY: -6, y: -6 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
            style={{ transformPerspective: 1000 }}
            className="mx-auto w-full max-w-md rounded-xl border border-akomapa-gold/40 bg-card p-8 shadow-lift sm:p-10"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-foreground">
                  Akomapa Academy
                </p>
                <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                  Certificate of completion
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-akomapa-gold/15 text-akomapa-gold">
                <Award className="h-6 w-6" aria-hidden />
              </span>
            </div>
            <div className="mt-8 border-t border-border pt-6">
              <p className="font-display text-2xl font-semibold text-foreground">
                Leadership, Power &amp; Responsibility
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Akomapa Global Health Education &amp; Leadership Program
              </p>
            </div>
            <div className="mt-8 flex items-end justify-between">
              <div className="text-sm">
                <p className="text-muted-foreground">Knowledge growth</p>
                <p className="font-semibold text-success">65% → 88% (+23%)</p>
              </div>
              <p className="font-mono text-xs tracking-wide text-muted-foreground">
                GHELP-2026-00042
              </p>
            </div>
          </motion.div>
        </SectionReveal>
      </div>
    </section>
  );
};
