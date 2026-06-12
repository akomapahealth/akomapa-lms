"use client";

import { Flame } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

interface StreakCounterProps {
  currentStreak: number;
}

export const StreakCounter = ({ currentStreak }: StreakCounterProps) => {
  const reduceMotion = useReducedMotion();

  if (currentStreak === 0) return null;

  const onFire = currentStreak >= 7;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        onFire
          ? "bg-akomapa-gold/20 text-akomapa-gold"
          : "bg-white/15 text-white/90"
      )}
    >
      <motion.span
        initial={false}
        animate={
          onFire && !reduceMotion ? { scale: [1, 1.25, 1] } : { scale: 1 }
        }
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      >
        <Flame className="h-4 w-4" aria-hidden />
      </motion.span>
      <span>{currentStreak} day streak</span>
    </div>
  );
};
