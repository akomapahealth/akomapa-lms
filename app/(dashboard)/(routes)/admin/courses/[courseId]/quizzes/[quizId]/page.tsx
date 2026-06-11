import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard, ListChecks } from "lucide-react";

import { db } from "@/lib/db";
import { IconBadge } from "@/components/icon-badge";
import { Banner } from "@/components/banner";

import { QuizTitleForm } from "./_components/quiz-title-form";
import { QuizSettingsForm } from "./_components/quiz-settings-form";
import { QuizActions } from "./_components/quiz-actions";
import { QuestionsForm } from "./_components/questions-form";

const QuizEditorPage = async ({
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
    where: { id: quizId, courseId },
    include: {
      questions: {
        orderBy: { position: "asc" },
        include: {
          options: {
            orderBy: { position: "asc" },
          },
        },
      },
      course: { select: { title: true } },
      module: { select: { title: true } },
    },
  });

  if (!quiz) {
    return redirect(`/admin/courses/${courseId}/quizzes`);
  }

  const requiredFields = [
    quiz.title,
    quiz.questions.length > 0,
    quiz.questions.every((q) => q.options.some((o) => o.isCorrect)),
  ];

  const totalFields = requiredFields.length;
  const completedFields = requiredFields.filter(Boolean).length;
  const completionText = `(${completedFields}/${totalFields})`;
  const isComplete = requiredFields.every(Boolean);

  return (
    <>
      {!quiz.isPublished && (
        <Banner label="This quiz is not published. It will not be visible to students." />
      )}
      <div className="px-4 py-6 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full">
            <Link
              href={`/admin/courses/${courseId}/quizzes`}
              className="flex items-center text-sm hover:opacity-75 transition mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to quizzes
            </Link>
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col gap-y-2">
                <h1 className="text-xl sm:text-2xl font-medium">Quiz Setup</h1>
                <span className="text-sm text-slate-700">
                  Complete all fields {completionText}
                </span>
              </div>
              <QuizActions
                courseId={courseId}
                quizId={quizId}
                isPublished={quiz.isPublished}
                disabled={!isComplete}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
          <div className="space-y-4">
            <div className="flex items-center gap-x-2">
              <IconBadge icon={LayoutDashboard} />
              <h2 className="text-xl">Quiz Details</h2>
            </div>
            <QuizTitleForm
              initialData={{ title: quiz.title }}
              courseId={courseId}
              quizId={quizId}
            />
            <QuizSettingsForm
              initialData={{
                type: quiz.type,
                timeLimitMinutes: quiz.timeLimitMinutes,
                passingScore: quiz.passingScore,
              }}
              courseId={courseId}
              quizId={quizId}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-x-2">
              <IconBadge icon={ListChecks} />
              <h2 className="text-xl">Questions</h2>
            </div>
            <QuestionsForm
              initialData={quiz.questions}
              courseId={courseId}
              quizId={quizId}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default QuizEditorPage;
