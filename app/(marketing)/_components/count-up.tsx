"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { motion } from "framer-motion";

interface CountUpProps {
  to: number;
  suffix?: string;
  className?: string;
}

export const CountUp = ({ to, suffix = "", className }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const value = useMotionValue(reduceMotion ? to : 0);
  const rounded = useTransform(value, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (inView && !reduceMotion) {
      const controls = animate(value, to, { duration: 1.6, ease: "circOut" });
      return controls.stop;
    }
  }, [inView, reduceMotion, to, value]);

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
};
