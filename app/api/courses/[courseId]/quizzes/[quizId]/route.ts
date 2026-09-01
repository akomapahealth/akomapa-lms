import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { quizUpdateSchema } from "@/lib/validations/quiz";
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
      "quiz:update",
      routeParams.courseId,
      routeParams.quizId
    );

    const body = await req.json();

    const parsed = quizUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return new NextResponse("Invalid data", { status: 400 });
    }

    const quiz = await db.quiz.update({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
      data: parsed.data,
    });

    return NextResponse.json(quiz);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUIZ_ID", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const principal = await requirePrincipal();
    await authorizeQuizInCourse(
      principal,
      "quiz:delete",
      routeParams.courseId,
      routeParams.quizId
    );

    const quiz = await db.quiz.delete({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUIZ_ID_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
