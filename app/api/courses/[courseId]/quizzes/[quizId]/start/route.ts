import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isPostTestUnlocked } from "@/actions/check-post-test-lock";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
      return new NextResponse("Not enrolled", { status: 403 });
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
      return new NextResponse("Quiz not found", { status: 404 });
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
    console.log("[QUIZ_START]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
