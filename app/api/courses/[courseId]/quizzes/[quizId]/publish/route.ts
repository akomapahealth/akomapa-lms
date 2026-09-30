import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseParams, problem } from "@/lib/http";
import { quizParams } from "@/lib/validations/ids";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    const routeParams = parseParams(quizParams, await params);

    const principal = await requirePrincipal();
    await authorizeQuizInCourse(
      principal,
      "quiz:publish",
      routeParams.courseId,
      routeParams.quizId
    );

    // Verify quiz has at least one question with a correct option
    const quiz = await db.quiz.findUnique({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
      include: {
        questions: {
          include: {
            options: { where: { isCorrect: true } },
          },
        },
      },
    });

    if (!quiz) {
      return problem("not_found");
    }

    // Publication invariants. State conflicts, not malformed input; #65 owns the
    // full set.
    if (quiz.questions.length === 0) {
      return problem("conflict", {
        message: "Add at least one question before publishing this quiz.",
      });
    }

    const allHaveCorrect = quiz.questions.every((q) => q.options.length > 0);
    if (!allHaveCorrect) {
      return problem("conflict", {
        message: "Every question needs a correct answer before publishing.",
      });
    }

    const updated = await db.quiz.update({
      where: { id: routeParams.quizId },
      data: { isPublished: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("QUIZ_PUBLISH", error);
  }
}
