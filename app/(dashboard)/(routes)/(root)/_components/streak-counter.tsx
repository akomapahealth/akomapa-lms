"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCounterProps {
  currentStreak: number;
}

export const StreakCounter = ({ currentStreak }: StreakCounterProps) => {
  if (currentStreak === 0) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
        currentStreak >= 7
          ? "bg-orange-100 text-orange-700"
          : "bg-slate-100 text-slate-600"
      )}
    >
      <Flame
        className={cn(
          "w-4 h-4",
          currentStreak >= 7 ? "text-orange-500" : "text-slate-400"
        )}
      />
      <span>{currentStreak} day streak</span>
    </div>
  );
};
