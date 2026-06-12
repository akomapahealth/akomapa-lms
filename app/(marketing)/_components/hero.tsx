"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";

const HEADLINE = "Empowering the next generation of health leaders.";

export const Hero = () => {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const words = HEADLINE.split(" ");

  return (
    <section
      ref={ref}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-surface-deep text-surface-deep-foreground"
    >
      <motion.div
        style={reduceMotion ? undefined : { y: mediaY }}
        className="absolute inset-0"
      >
        <Image
          src="/landing/hero-poster.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {!reduceMotion && (
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
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(187_80%_10%)]/70 via-[hsl(187_80%_12%)]/55 to-[hsl(187_80%_10%)]/85" />
      </motion.div>

      <motion.div
        style={reduceMotion ? undefined : { opacity: contentOpacity }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-32 text-center"
      >
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xs font-semibold uppercase tracking-[0.28em] text-akomapa-gold sm:text-sm"
        >
          Nya Akomapa — Have a good heart
        </motion.p>
        <h1 className="font-display mt-6 text-balance text-4xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl">
          {words.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              className="inline-block"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.25 + i * 0.06,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
            >
              {word}
              {i < words.length - 1 && <span>&nbsp;</span>}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="mt-6 max-w-2xl text-pretty text-base leading-relaxed opacity-85 sm:text-lg"
        >
          Student-powered, expert-supervised learning through the Akomapa
          Global Health Education &amp; Leadership Program — GHELP.
        </motion.p>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.05 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row"
        >
          <Link href="/sign-up">
            <Button
              size="lg"
              className="h-12 bg-akomapa-gold px-8 text-base font-semibold text-[hsl(187_80%_10%)] hover:bg-akomapa-gold/90"
            >
              Begin your journey
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-surface-deep-foreground/40 bg-transparent px-8 text-base text-surface-deep-foreground hover:bg-surface-deep-foreground/10 hover:text-surface-deep-foreground"
            >
              Sign in
            </Button>
          </Link>
        </motion.div>
      </motion.div>

      {!reduceMotion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-6 w-6" aria-hidden />
          </motion.div>
        </motion.div>
      )}
    </section>
  );
};
