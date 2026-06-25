"use client";

import { useQuizStore, QuizQuestion as QuizQuestionType } from "@/hooks/use-quiz-store";
import { cn } from "@/lib/utils";

export const QuizQuestion = () => {
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const selectAnswer = useQuizStore((s) => s.selectAnswer);

  const question = questions[currentIndex];

  if (!question) return null;

  const selectedOptionId = answers[question.id];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-medium text-foreground">{question.text}</p>
      </div>

      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const letter = String.fromCharCode(65 + idx); // A, B, C, D...
          const isSelected = selectedOptionId === option.id;

          return (
            <button
              key={option.id}
              onClick={() => selectAnswer(question.id, option.id)}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                "hover:border-akomapa-teal/50 hover:bg-akomapa-teal/5",
                isSelected
                  ? "border-akomapa-teal bg-akomapa-teal/5"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium",
                    isSelected
                      ? "bg-akomapa-teal text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {letter}
                </span>
                <span className="text-sm text-foreground pt-0.5">
                  {option.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
