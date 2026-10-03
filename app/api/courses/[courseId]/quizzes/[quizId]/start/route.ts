import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { courseEntitlement, LOCKED_STATE_MESSAGE } from "@/lib/entitlement";
import { isPostTestUnlocked } from "@/actions/check-post-test-lock";
import { assertTrustedOrigin, handleRouteError, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { quizParams } from "@/lib/validations/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const routeParams = parseParams(quizParams, await params);

    const principal = await requirePrincipal();
    await enforceRateLimit(req, "quiz.start", { userId: principal.userId });
    const { userId } = principal;

    // Entitlement, not payment history. Reading `Purchase` here let a suspended
    // learner start a quiz, because the Purchase row survives a suspension.
    const entitlement = await courseEntitlement(principal, routeParams.courseId);

    if (!entitlement.canLearn) {
      return problem("forbidden", {
        message: LOCKED_STATE_MESSAGE[entitlement.reason] ||
          "Enroll in this course to take its quizzes.",
      });
    }

    const quiz = await db.quiz.findUnique({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
        isPublished: true,
      },
      include: {
        questions: {
          orderBy: { position: "asc" },
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
                position: true,
                // Never send isCorrect to client
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return problem("not_found");
    }

    // Check post-test lock
    if (quiz.type === "POST_TEST") {
      const lockStatus = await isPostTestUnlocked(userId, routeParams.courseId);
      if (!lockStatus.unlocked) {
        return NextResponse.json(
          {
            locked: true,
            completedModules: lockStatus.completedModules,
            totalModules: lockStatus.totalModules,
          },
          { status: 403 }
        );
      }
    }

    // Create attempt
    const attempt = await db.quizAttempt.create({
      data: {
        userId,
        quizId: routeParams.quizId,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      timeLimit: quiz.timeLimitMinutes,
      questions: quiz.questions,
    });
  } catch (error) {
    return handleRouteError("QUIZ_START", error);
  }
}
