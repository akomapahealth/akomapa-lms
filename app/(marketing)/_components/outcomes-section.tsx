"use client";

import { motion } from "framer-motion";

import { CountUp } from "./count-up";

const bars = [
  { label: "Average pre-test", value: 65, className: "bg-surface-deep-foreground/30" },
  { label: "Average post-test", value: 88, className: "bg-akomapa-gold" },
];

export const OutcomesSection = () => {
  return (
    <section
      id="outcomes"
      className="bg-surface-deep py-24 text-surface-deep-foreground sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-gold">
            Measured outcomes
          </p>
          <h2 className="font-display mt-6 text-pretty text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
            Growth you can see. Progress you can prove.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed opacity-80">
            Every GHELP course begins with a pre-test and ends with a
            post-test, so your learning is measured — not assumed. Finish a
            course and your certificate carries the growth you earned, with an
            ID anyone can verify.
          </p>
          <div className="mt-8 flex items-baseline gap-3">
            <CountUp
              to={23}
              suffix="%"
              className="font-display text-6xl font-semibold text-akomapa-gold sm:text-7xl"
            />
            <span className="text-sm uppercase tracking-[0.18em] opacity-70">
              average knowledge growth
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="opacity-80">{bar.label}</span>
                <span className="font-display text-lg font-semibold">
                  {bar.value}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-deep-foreground/10">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${bar.value}%` }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 1.2, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className={`h-full rounded-full ${bar.className}`}
                />
              </div>
            </div>
          ))}
          <p className="text-xs uppercase tracking-[0.18em] opacity-50">
            Example: Leadership, Power &amp; Responsibility cohort
          </p>
        </div>
      </div>
    </section>
  );
};
