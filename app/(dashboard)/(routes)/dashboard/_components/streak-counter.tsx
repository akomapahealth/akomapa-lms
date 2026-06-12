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
          ? "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground"
      )}
    >
      <Flame
        className={cn(
          "w-4 h-4",
          currentStreak >= 7 ? "text-warning" : "text-muted-foreground/70"
        )}
      />
      <span>{currentStreak} day streak</span>
    </div>
  );
};
