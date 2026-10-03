import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { growthQuizConflict } from "@/lib/assessments/growth-quiz";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseParams } from "@/lib/validations/ids";
import { quizCreateSchema } from "@/lib/validations/quiz";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const routeParams = parseParams(courseParams, await params);

    const principal = await requirePrincipal();
    await enforceRateLimit(req, "write.default", { userId: principal.userId });
    await authorizeCourse(principal, "quiz:create", routeParams.courseId);

    // `type` is now the schema's enum. It used to be any non-empty string, and
    // `type` is what decides whether the post-test lock applies -- so a quiz
    // stored with an unrecognised type was never locked.
    const body = await parseBody(quizCreateSchema, req);

    const conflict = await growthQuizConflict(routeParams.courseId, body.type);
    if (conflict !== null) return problem("conflict", { message: conflict });

    const quiz = await db.quiz.create({
      data: {
        title: body.title,
        type: body.type,
        courseId: routeParams.courseId,
        moduleId: body.moduleId ?? null,
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    return handleRouteError("QUIZZES", error);
  }
}
