"use client";

import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useQuizStore } from "@/hooks/use-quiz-store";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface QuizNavigationProps {
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const QuizNavigation = ({
  onSubmit,
  isSubmitting,
}: QuizNavigationProps) => {
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const prevQuestion = useQuizStore((s) => s.prevQuestion);

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const unansweredCount = questions.filter((q) => !answers[q.id]).length;

  return (
    <div className="flex items-center justify-between pt-4">
      <Button
        variant="outline"
        onClick={prevQuestion}
        disabled={isFirst}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      <div className="flex items-center gap-2">
        {!isLast && (
          <Button
            variant="outline"
            onClick={nextQuestion}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="bg-akomapa-teal hover:bg-akomapa-teal-dark text-white gap-1"
              disabled={isSubmitting}
            >
              <Send className="h-4 w-4" />
              Submit Quiz
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
              <AlertDialogDescription>
                {unansweredCount > 0
                  ? `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? "s" : ""}. Are you sure you want to submit?`
                  : "Are you sure you want to submit your quiz? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={onSubmit}
                className="bg-akomapa-teal hover:bg-akomapa-teal-dark"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
