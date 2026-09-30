import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseParams } from "@/lib/http";
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

    const updated = await db.quiz.update({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
      data: { isPublished: false },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("QUIZ_UNPUBLISH", error);
  }
}
