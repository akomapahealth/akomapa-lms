import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { isPostTestUnlocked } from "@/actions/check-post-test-lock";
import { handleRouteError, parseParams, problem } from "@/lib/http";
import { quizParams } from "@/lib/validations/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    const routeParams = parseParams(quizParams, await params);

    const { userId } = await requirePrincipal();

    // Verify enrollment
    const purchase = await db.purchase.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: routeParams.courseId,
        },
      },
    });

    if (!purchase) {
      return problem("forbidden", {
        message: "Enroll in this course to take its quizzes.",
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
