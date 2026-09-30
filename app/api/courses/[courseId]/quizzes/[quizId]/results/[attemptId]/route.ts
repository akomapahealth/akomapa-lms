import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { attemptInQuizAndCourse } from "@/lib/assessments/attempt-access";
import { handleRouteError, parseParams, problem } from "@/lib/http";
import { attemptParams } from "@/lib/validations/ids";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string; attemptId: string }> }
) {
  try {
    const routeParams = parseParams(attemptParams, await params);

    const { userId } = await requirePrincipal();

    // Bound to the route's Quiz and Course, not just to the caller. An attempt
    // from one Quiz should not render through another Quiz's URL.
    const attempt = await db.quizAttempt.findFirst({
      where: attemptInQuizAndCourse(
        userId,
        routeParams.courseId,
        routeParams.quizId,
        routeParams.attemptId
      ),
      include: {
        quiz: {
          select: {
            title: true,
            type: true,
            passingScore: true,
            timeLimitMinutes: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                text: true,
                position: true,
                points: true,
                options: {
                  orderBy: { position: "asc" },
                  select: {
                    id: true,
                    text: true,
                    isCorrect: true,
                    position: true,
                  },
                },
              },
            },
            selectedOption: {
              select: { id: true, text: true },
            },
          },
        },
      },
    });

    if (!attempt) {
      return problem("not_found");
    }

    if (!attempt.completedAt) {
      // The answer key is in this payload, so an in-flight attempt must not read
      // its own results. A state conflict, not bad input.
      return problem("conflict", { message: "This attempt is not submitted yet." });
    }

    return NextResponse.json(attempt);
  } catch (error) {
    return handleRouteError("QUIZ_RESULTS", error);
  }
}
