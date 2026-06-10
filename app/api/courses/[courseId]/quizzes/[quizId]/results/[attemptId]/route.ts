import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string; attemptId: string }> }
) {
  const routeParams = await params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { id: routeParams.attemptId },
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

    if (!attempt || attempt.userId !== userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!attempt.completedAt) {
      return new NextResponse("Quiz not yet completed", { status: 400 });
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.log("[QUIZ_RESULTS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
