import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { hasLearnerRecords, LEARNER_RECORDS_CONFLICT } from "@/lib/courses/learner-records";
import { enforceRateLimit } from "@/lib/rate-limit";
import { quizParams } from "@/lib/validations/ids";
import { quizUpdateSchema } from "@/lib/validations/quiz";

export async function PATCH(
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
      "quiz:update",
      routeParams.courseId,
      routeParams.quizId
    );

    const values = await parseBody(quizUpdateSchema, req);

    const quiz = await db.quiz.update({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
      data: values,
    });

    return NextResponse.json(quiz);
  } catch (error) {
    return handleRouteError("QUIZ_ID", error);
  }
}

export async function DELETE(
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
      "quiz:delete",
      routeParams.courseId,
      routeParams.quizId
    );

    // Attempts are learning records and grades (#51); a Quiz learners have
    // taken is unpublished, not deleted. RESTRICT backs this up under a race.
    if (await hasLearnerRecords({ kind: "quiz", quizId: routeParams.quizId })) {
      return problem("conflict", { message: LEARNER_RECORDS_CONFLICT.quiz });
    }

    const quiz = await db.quiz.delete({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    return handleRouteError("QUIZ_ID_DELETE", error);
  }
}
