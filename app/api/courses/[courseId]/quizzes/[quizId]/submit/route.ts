import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

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

    const { attemptId, answers } = await req.json() as {
      attemptId: string;
      answers: { questionId: string; selectedOptionId: string }[];
    };

    // Verify attempt belongs to user and is not completed
    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: { timeLimitMinutes: true, passingScore: true },
        },
      },
    });

    if (!attempt || attempt.userId !== userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (attempt.completedAt) {
      return new NextResponse("Quiz already submitted", { status: 400 });
    }

    // Server-side time validation (30s grace period)
    if (attempt.quiz.timeLimitMinutes) {
      const elapsed = (Date.now() - attempt.startedAt.getTime()) / 1000;
      const allowedSeconds = attempt.quiz.timeLimitMinutes * 60 + 30;
      if (elapsed > allowedSeconds) {
        return new NextResponse("Time limit exceeded", { status: 400 });
      }
    }

    // Fetch all questions with correct answers
    const questions = await db.question.findMany({
      where: { quizId: routeParams.quizId },
      include: {
        options: {
          select: { id: true, isCorrect: true },
        },
      },
    });

    // Grade each answer
    let totalScore = 0;
    let totalPoints = 0;
    const results: {
      questionId: string;
      correct: boolean;
      selectedOptionId: string | null;
      correctOptionId: string;
    }[] = [];

    for (const question of questions) {
      const correctOption = question.options.find((o) => o.isCorrect);
      const userAnswer = answers.find((a) => a.questionId === question.id);

      totalPoints += question.points;

      const isCorrect =
        userAnswer?.selectedOptionId === correctOption?.id;

      if (isCorrect) {
        totalScore += question.points;
      }

      results.push({
        questionId: question.id,
        correct: isCorrect,
        selectedOptionId: userAnswer?.selectedOptionId ?? null,
        correctOptionId: correctOption?.id ?? "",
      });
    }

    // Save answers
    await db.quizAnswer.createMany({
      data: answers.map((a) => ({
        attemptId,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
      })),
    });

    // Update attempt
    await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        totalPoints,
        completedAt: new Date(),
      },
    });

    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;

    return NextResponse.json({
      attemptId,
      score: totalScore,
      totalPoints,
      percentage,
      passed: percentage >= attempt.quiz.passingScore,
      results,
    });
  } catch (error) {
    console.log("[QUIZ_SUBMIT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
