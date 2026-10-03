import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { quizParams } from "@/lib/validations/ids";
import { questionCreateSchema } from "@/lib/validations/quiz";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const routeParams = parseParams(quizParams, await params);

    const principal = await requirePrincipal();
    await enforceRateLimit(req, "write.default", { userId: principal.userId });
    await authorizeQuizInCourse(
      principal,
      "question:create",
      routeParams.courseId,
      routeParams.quizId
    );

    const { text } = await parseBody(questionCreateSchema, req);

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
    return handleRouteError("QUESTIONS", error);
  }
}
