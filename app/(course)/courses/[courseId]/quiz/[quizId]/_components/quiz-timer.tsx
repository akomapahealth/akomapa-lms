"use client";

import { useEffect } from "react";
import { Clock } from "lucide-react";
import { useQuizStore } from "@/hooks/use-quiz-store";
import { cn } from "@/lib/utils";

export const QuizTimer = () => {
  const timeRemaining = useQuizStore((s) => s.timeRemaining);
  const quizId = useQuizStore((s) => s.quizId);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const isWarning = timeRemaining <= 300 && timeRemaining > 0; // 5 minutes
  const isCritical = timeRemaining <= 60 && timeRemaining > 0;

  useEffect(() => {
    if (quizId) {
      document.title = `${display} - Quiz`;
    }
    return () => {
      document.title = "Akomapa LMS";
    };
  }, [display, quizId]);

  if (timeRemaining <= 0 && quizId) {
    return (
      <div className="flex items-center gap-2 text-red-600 font-semibold">
        <Clock className="h-4 w-4" />
        <span>Time&apos;s up!</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-sm font-medium",
        isWarning && "text-amber-600",
        isCritical && "text-red-600 animate-pulse"
      )}
    >
      <Clock className="h-4 w-4" />
      <span>{display} remaining</span>
    </div>
  );
};
