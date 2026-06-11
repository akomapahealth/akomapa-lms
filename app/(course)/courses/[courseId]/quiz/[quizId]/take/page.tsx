"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

import { useQuizStore } from "@/hooks/use-quiz-store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { QuizTimer } from "../_components/quiz-timer";
import { QuizQuestion } from "../_components/quiz-question";
import { QuizProgressBar } from "../_components/quiz-progress-bar";
import { QuizNavigation } from "../_components/quiz-navigation";

const QuizTakePage = () => {
  const params = useParams<{ courseId: string; quizId: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    setQuiz,
    tick,
    submit,
    reset,
    timeRemaining,
    isSubmitted,
    questions,
    answers,
    attemptId,
  } = useQuizStore();

  // Start quiz on mount
  useEffect(() => {
    const startQuiz = async () => {
      try {
        const response = await axios.post(
          `/api/courses/${params.courseId}/quizzes/${params.quizId}/start`
        );

        const data = response.data;

        if (data.locked) {
          toast.error("Post-test is locked. Complete all modules first.");
          router.push(`/courses/${params.courseId}`);
          return;
        }

        const timeLimitSeconds = (data.timeLimit || 30) * 60;
        setQuiz(params.quizId, data.attemptId, data.questions, timeLimitSeconds);
        setIsLoading(false);
      } catch (error) {
        toast.error("Failed to start quiz");
        router.push(`/courses/${params.courseId}/quiz/${params.quizId}`);
      }
    };

    startQuiz();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (!isLoading && !isSubmitted) {
      timerRef.current = setInterval(() => {
        tick();
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isLoading, isSubmitted, tick]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeRemaining <= 0 && !isSubmitted && !isLoading && attemptId) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  // Warn on page navigation
  useEffect(() => {
    if (!isSubmitted && !isLoading) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [isSubmitted, isLoading]);

  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answers).map(
        ([questionId, selectedOptionId]) => ({
          questionId,
          selectedOptionId,
        })
      );

      const response = await axios.post(
        `/api/courses/${params.courseId}/quizzes/${params.quizId}/submit`,
        {
          attemptId,
          answers: formattedAnswers,
        }
      );

      submit();

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      router.push(
        `/courses/${params.courseId}/quiz/${params.quizId}/results/${response.data.attemptId}`
      );
    } catch (error) {
      toast.error("Failed to submit quiz");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-akomapa-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-3xl mx-auto pb-20">
      <div className="px-4 py-4 sm:p-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Quiz</h2>
              <QuizTimer />
            </div>
            <QuizProgressBar />
          </CardHeader>
          <CardContent className="pt-2">
            <QuizQuestion />
            <QuizNavigation
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizTakePage;
