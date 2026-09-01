import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
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
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUIZ_UNPUBLISH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
