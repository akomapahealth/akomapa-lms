"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

interface CountUpProps {
  to: number;
  suffix?: string;
  className?: string;
}

/**
 * Server-renders the final value (stable hydration regardless of the
 * visitor's motion preference), then counts up from 0 once in view.
 */
export const CountUp = ({ to, suffix = "", className }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(`${to}${suffix}`);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: "circOut",
      onUpdate: (v) => setDisplay(`${Math.round(v)}${suffix}`),
    });
    return () => controls.stop();
  }, [inView, reduceMotion, to, suffix]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
};
