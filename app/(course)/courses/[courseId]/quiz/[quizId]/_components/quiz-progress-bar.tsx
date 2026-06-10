"use client";

import { useQuizStore } from "@/hooks/use-quiz-store";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const QuizProgressBar = () => {
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const goToQuestion = useQuizStore((s) => s.goToQuestion);

  const totalQuestions = questions.length;
  const progressPercentage =
    totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <span>{Math.round(progressPercentage)}%</span>
      </div>

      <Progress value={progressPercentage} className="h-2" />

      <div className="flex flex-wrap gap-1.5 justify-center">
        {questions.map((q, idx) => {
          const isAnswered = !!answers[q.id];
          const isCurrent = idx === currentIndex;

          return (
            <button
              key={q.id}
              onClick={() => goToQuestion(idx)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-200",
                isCurrent && "ring-2 ring-akomapa-teal ring-offset-1",
                isAnswered
                  ? "bg-akomapa-teal"
                  : "bg-slate-200 hover:bg-slate-300"
              )}
              title={`Question ${idx + 1}${isAnswered ? " (answered)" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
};
