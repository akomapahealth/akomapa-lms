import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Clock } from "lucide-react";

import { db } from "@/lib/db";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import { ResultsConfetti } from "./_components/results-confetti";

const QuizResultsPage = async ({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string; attemptId: string }>;
}) => {
  const { courseId, quizId, attemptId } = await params;
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        select: {
          title: true,
          type: true,
          passingScore: true,
          timeLimitMinutes: true,
          course: { select: { title: true } },
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              text: true,
              position: true,
              points: true,
              options: {
                orderBy: { position: "asc" },
                select: {
                  id: true,
                  text: true,
                  isCorrect: true,
                  position: true,
                },
              },
            },
          },
          selectedOption: {
            select: { id: true, text: true },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId || !attempt.completedAt) {
    return redirect(`/courses/${courseId}`);
  }

  const totalPoints = attempt.totalPoints ?? 0;
  const score = attempt.score ?? 0;
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percentage >= attempt.quiz.passingScore;

  // Calculate time taken
  const startMs = attempt.startedAt.getTime();
  const endMs = attempt.completedAt.getTime();
  const diffSec = Math.floor((endMs - startMs) / 1000);
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  const timeTaken = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const typeLabel =
    attempt.quiz.type === "PRE_TEST"
      ? "Pre-Test"
      : attempt.quiz.type === "POST_TEST"
        ? "Post-Test"
        : "Module Quiz";

  // Sort answers by question position
  const sortedAnswers = [...attempt.answers].sort(
    (a, b) => a.question.position - b.question.position
  );

  return (
    <>
      <ResultsConfetti passed={passed} />
      <div className="flex flex-col max-w-3xl mx-auto pb-20">
        <div className="px-4 pt-4">
          <Breadcrumb
            items={[
              { label: "Courses", href: "/courses" },
              {
                label: attempt.quiz.course?.title ?? "Course",
                href: `/courses/${courseId}`,
              },
              { label: `${typeLabel} Results` },
            ]}
          />
        </div>

        <div className="px-4 py-4 sm:p-4 space-y-4">
          {/* Score Card */}
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge
                    variant="outline"
                    className="text-akomapa-teal border-akomapa-teal mb-2"
                  >
                    {typeLabel} Results
                  </Badge>
                  <CardTitle className="text-xl">
                    {attempt.quiz.title}
                  </CardTitle>
                </div>
                <div
                  className={`text-center px-4 py-2 rounded-lg ${
                    passed
                      ? "bg-success/10 text-success"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  <p className="text-2xl font-bold">{percentage}%</p>
                  <p className="text-sm font-medium">
                    {passed ? "✓ Passed" : "✗ Not Passed"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-6 text-sm text-muted-foreground">
                <div>
                  Score: {score}/{totalPoints}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {timeTaken}
                  {attempt.quiz.timeLimitMinutes &&
                    ` / ${attempt.quiz.timeLimitMinutes}:00`}
                </div>
              </div>

              <Progress
                value={percentage}
                className="h-3"
              />
            </CardContent>
          </Card>

          {/* Question Review */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Question Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedAnswers.map((answer, idx) => {
                const correctOption = answer.question.options.find(
                  (o) => o.isCorrect
                );
                const isCorrect =
                  answer.selectedOption?.id === correctOption?.id;

                return (
                  <div key={answer.question.id}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {idx + 1}. {answer.question.text}
                          </p>
                          {!isCorrect && (
                            <>
                              <p className="text-sm text-red-600">
                                Your answer:{" "}
                                {answer.selectedOption?.text ?? "No answer"}
                              </p>
                              <p className="text-sm text-success">
                                Correct answer: {correctOption?.text}
                              </p>
                            </>
                          )}
                          {isCorrect && (
                            <p className="text-sm text-success">
                              {answer.selectedOption?.text}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/courses/${courseId}`}>
              <Button variant="outline" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back to Course
              </Button>
            </Link>
            <Link href={`/courses/${courseId}/quiz/${quizId}`}>
              <Button
                variant="outline"
                className="gap-1 text-akomapa-teal border-akomapa-teal hover:bg-akomapa-teal/5"
              >
                <RotateCcw className="h-4 w-4" />
                Retake Quiz
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuizResultsPage;
