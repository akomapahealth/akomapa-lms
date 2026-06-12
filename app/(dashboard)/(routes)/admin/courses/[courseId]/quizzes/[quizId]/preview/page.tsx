import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const QuizPreviewPage = async ({
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
          options: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!quiz) {
    return redirect(`/admin/courses/${courseId}/quizzes`);
  }

  return (
    <div className="px-4 py-6 sm:p-6 max-w-3xl mx-auto">
      <Link
        href={`/admin/courses/${courseId}/quizzes/${quizId}`}
        className="flex items-center text-sm hover:opacity-75 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to editor
      </Link>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="text-akomapa-teal border-akomapa-teal">
          Preview Mode
        </Badge>
        <Badge variant="secondary">
          {quiz.questions.length} Questions
        </Badge>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold mb-6">{quiz.title}</h1>

      <div className="space-y-6">
        {quiz.questions.map((question, qIdx) => (
          <Card key={question.id} className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                {qIdx + 1}. {question.text}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {question.points} point{question.points !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {question.options.map((option, oIdx) => {
                const letter = String.fromCharCode(65 + oIdx);
                return (
                  <div
                    key={option.id}
                    className={cn(
                      "p-3 rounded-lg border-2 text-sm",
                      option.isCorrect
                        ? "border-success/40 bg-success/10"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                          option.isCorrect
                            ? "bg-success text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {letter}
                      </span>
                      <span className="pt-0.5">{option.text}</span>
                      {option.isCorrect && (
                        <Badge className="ml-auto bg-success text-xs">
                          Correct
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default QuizPreviewPage;
