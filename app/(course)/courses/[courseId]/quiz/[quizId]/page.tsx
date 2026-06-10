import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, FileQuestion, Lock, CheckCircle2, ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { isPostTestUnlocked } from "@/actions/check-post-test-lock";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const QuizEntryPage = async ({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) => {
  const { courseId, quizId } = await params;
  const { userId } = await auth();

  if (!userId) {
    return redirect("/sign-in");
  }

  const quiz = await db.quiz.findUnique({
    where: {
      id: quizId,
      isPublished: true,
    },
    include: {
      course: { select: { title: true } },
      module: { select: { title: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { userId, completedAt: { not: null } },
        orderBy: { score: "desc" },
        take: 1,
      },
    },
  });

  if (!quiz) {
    return redirect(`/courses/${courseId}`);
  }

  const hasCompleted = quiz.attempts.length > 0;
  const bestAttempt = quiz.attempts[0];
  const bestPercentage =
    bestAttempt && bestAttempt.totalPoints
      ? Math.round((bestAttempt.score! / bestAttempt.totalPoints) * 100)
      : null;

  // Check post-test lock
  let lockStatus = null;
  if (quiz.type === "POST_TEST") {
    lockStatus = await isPostTestUnlocked(userId, courseId);
  }

  const isLocked = quiz.type === "POST_TEST" && lockStatus && !lockStatus.unlocked;

  const typeLabel =
    quiz.type === "PRE_TEST"
      ? "Pre-Test"
      : quiz.type === "POST_TEST"
        ? "Post-Test"
        : "Module Quiz";

  return (
    <div className="flex flex-col max-w-3xl mx-auto pb-20">
      <div className="px-4 pt-4">
        <Breadcrumb
          items={[
            { label: "Courses", href: "/courses" },
            { label: quiz.course?.title ?? "Course", href: `/courses/${courseId}` },
            { label: typeLabel },
          ]}
        />
      </div>

      <div className="p-4 mt-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className="text-akomapa-teal border-akomapa-teal"
              >
                {typeLabel}
              </Badge>
              {quiz.module && (
                <Badge variant="secondary">{quiz.module.title}</Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{quiz.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4" />
                <span>{quiz._count.questions} Questions</span>
              </div>
              {quiz.timeLimitMinutes && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{quiz.timeLimitMinutes} minutes</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Passing: {quiz.passingScore}%</span>
              </div>
            </div>

            {quiz.type === "PRE_TEST" && (
              <p className="text-sm text-slate-500">
                This pre-test assesses your current understanding before
                beginning the course modules.
              </p>
            )}
            {quiz.type === "POST_TEST" && !isLocked && (
              <p className="text-sm text-slate-500">
                This post-test evaluates what you&apos;ve learned after
                completing all course modules.
              </p>
            )}
            {quiz.type === "MODULE_QUIZ" && (
              <p className="text-sm text-slate-500">
                This quiz tests your understanding of the module content.
              </p>
            )}

            {isLocked && lockStatus ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center space-y-3">
                <Lock className="h-10 w-10 text-slate-400 mx-auto" />
                <h3 className="font-semibold text-slate-700">
                  Post-Test Locked
                </h3>
                <p className="text-sm text-slate-500">
                  Complete all modules to unlock this assessment.
                </p>
                <p className="text-sm text-slate-500">
                  Progress: {lockStatus.completedModules}/{lockStatus.totalModules} modules completed
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {hasCompleted && bestPercentage !== null && (
                  <div
                    className={`p-4 rounded-lg border ${
                      bestPercentage >= quiz.passingScore
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <p className="text-sm font-medium">
                      {bestPercentage >= quiz.passingScore ? "✓ Passed" : "✗ Not Passed"} — Best Score: {bestPercentage}%
                    </p>
                    <Link
                      href={`/courses/${courseId}/quiz/${quizId}/results/${bestAttempt.id}`}
                      className="text-sm text-akomapa-teal hover:underline mt-1 inline-block"
                    >
                      View Results →
                    </Link>
                  </div>
                )}

                <Link href={`/courses/${courseId}/quiz/${quizId}/take`}>
                  <Button
                    size="lg"
                    className="w-full bg-akomapa-teal hover:bg-akomapa-teal-dark text-white"
                  >
                    {hasCompleted ? "Retake Quiz" : "Start Quiz"}
                  </Button>
                </Link>
              </div>
            )}

            <Link
              href={`/courses/${courseId}`}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-akomapa-teal transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Course
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizEntryPage;
