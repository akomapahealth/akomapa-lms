import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const principal = await requirePrincipal();
    await authorizeQuizInCourse(
      principal,
      "question:create",
      routeParams.courseId,
      routeParams.quizId
    );

    const { text } = await req.json();

    if (!text) {
      return new NextResponse("Question text is required", { status: 400 });
    }

    const lastQuestion = await db.question.findFirst({
      where: { quizId: routeParams.quizId },
      orderBy: { position: "desc" },
    });

    const newPosition = lastQuestion ? lastQuestion.position + 1 : 1;

    const question = await db.question.create({
      data: {
        text,
        quizId: routeParams.quizId,
        position: newPosition,
      },
    });

    return NextResponse.json(question);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUESTIONS", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
