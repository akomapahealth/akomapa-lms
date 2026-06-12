"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";

const HEADLINE = "Empowering the next generation of health leaders.";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export const Hero = () => {
  const reduceMotion = useReducedMotion();
  // Mount-gated so the server never renders the video (avoids hydration
  // mismatch — useReducedMotion is only known on the client).
  const [showVideo, setShowVideo] = useState(false);
  useEffect(() => {
    if (!reduceMotion) setShowVideo(true);
  }, [reduceMotion]);

  const words = HEADLINE.split(" ");

  return (
    <section className="bg-surface-deep text-surface-deep-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-36 lg:px-8 lg:pt-44">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-gold sm:text-sm"
        >
          Nya Akomapa — Have a good heart
        </motion.p>

        <h1 className="font-display mt-7 max-w-5xl text-balance text-[2.75rem] font-semibold leading-[1.04] sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
          {words.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              className="inline-block"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.2 + i * 0.05,
                ease: EASE,
              }}
            >
              {word}
              {i < words.length - 1 && <span>&nbsp;</span>}
            </motion.span>
          ))}
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8, ease: EASE }}
          className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
        >
          <p className="max-w-xl text-pretty text-base leading-relaxed opacity-85 sm:text-lg">
            Student-powered, expert-supervised learning through the Akomapa
            Global Health Education &amp; Leadership Program — GHELP.
          </p>
          <div className="flex shrink-0 items-center gap-6">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="h-12 bg-akomapa-gold px-8 text-base font-semibold text-[hsl(187_80%_10%)] hover:bg-akomapa-gold/90"
              >
                Begin your journey
              </Button>
            </Link>
            <Link
              href="/sign-in"
              className="text-sm font-semibold underline-offset-4 opacity-80 transition hover:opacity-100 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </motion.div>

        {/* Framed media block — no overlay, the film speaks for itself */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1, ease: EASE }}
          className="mt-14 overflow-hidden rounded-2xl ring-1 ring-surface-deep-foreground/15 sm:mt-16"
        >
          <div className="relative aspect-[16/10] sm:aspect-[21/10]">
            <Image
              src="/landing/hero-poster.jpg"
              alt="Akomapa student leaders providing community health care"
              fill
              priority
              sizes="(min-width: 1280px) 1216px, 100vw"
              className="object-cover"
            />
            {showVideo && (
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/landing/hero-poster.jpg"
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src="/landing/hero.mp4" type="video/mp4" />
              </video>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
