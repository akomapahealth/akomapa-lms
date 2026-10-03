import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { withPositionRetry } from "@/lib/courses/ordering";
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

    // "Last position + 1" races a concurrent create to the same position; the
    // per-Quiz unique index refuses the loser, which reads again (#51).
    const question = await withPositionRetry(async () => {
      const lastQuestion = await db.question.findFirst({
        where: { quizId: routeParams.quizId },
        orderBy: { position: "desc" },
      });

      return db.question.create({
        data: {
          text,
          quizId: routeParams.quizId,
          position: lastQuestion ? lastQuestion.position + 1 : 1,
        },
      });
    });

    return NextResponse.json(question);
  } catch (error) {
    return handleRouteError("QUESTIONS", error);
  }
}
