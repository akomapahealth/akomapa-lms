import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const faculty = await isFaculty(userId);
    if (!faculty) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
      return new NextResponse("Quiz not found", { status: 404 });
    }

    if (quiz.questions.length === 0) {
      return new NextResponse("Quiz must have at least one question", { status: 400 });
    }

    const allHaveCorrect = quiz.questions.every((q) => q.options.length > 0);
    if (!allHaveCorrect) {
      return new NextResponse("Every question must have a correct answer", { status: 400 });
    }

    const updated = await db.quiz.update({
      where: { id: routeParams.quizId },
      data: { isPublished: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError("QUIZ_PUBLISH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
