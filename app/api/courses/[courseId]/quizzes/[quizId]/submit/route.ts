import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { findLearnerAttempt } from "@/lib/assessments/attempt-access";
import { gradeSubmission, validateSubmission } from "@/lib/assessments/grading";
import { evaluateBadges } from "@/lib/badge-service";
import { logError } from "@/lib/logger";

const submissionSchema = z.object({
  attemptId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().min(1),
      })
    )
    // Bounded so a submission cannot be used to write an unlimited number of
    // rows. A Quiz with more questions than this cannot be graded here, which
    // is a deliberate ceiling rather than an accident.
    .max(500),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const { userId } = await requirePrincipal();

    const parsed = submissionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new NextResponse("Invalid data", { status: 400 });
    }
    const { attemptId, answers } = parsed.data;

    // The attempt must be this learner's, on this Quiz, in this Course. It was
    // previously loaded by id and checked only for ownership, while grading ran
    // against the route's Quiz -- so an attempt started on one Quiz could be
    // submitted through another Quiz's URL and scored against questions it was
    // never issued.
    const attempt = await findLearnerAttempt(
      userId,
      routeParams.courseId,
      routeParams.quizId,
      attemptId
    );

    if (!attempt) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (attempt.completedAt) {
      return new NextResponse("Quiz already submitted", { status: 409 });
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
    // The attempt's own Quiz, which the binding above has proven is the route's.
    const questions = await db.question.findMany({
      where: { quizId: attempt.quizId },
      include: {
        options: {
          select: { id: true, isCorrect: true },
        },
      },
    });

    // Every submitted Question must belong to this Quiz, every selected option
    // to that Question, and no Question may be answered twice. Foreign-but-real
    // ids satisfy the database's foreign keys, so nothing else rejected them.
    const invalid = validateSubmission(questions, answers);
    if (invalid) {
      return new NextResponse("Invalid submission", { status: 400 });
    }

    const { totalScore, totalPoints, percentage, results } = gradeSubmission(
      questions,
      answers
    );

    // Answers and finalisation commit together. The conditional update is what
    // makes submission idempotent under a double-click or a retry: two
    // concurrent submissions both pass the completedAt check above, and only
    // the one that actually flips the row from null commits. #63 replaces this
    // with a full attempt state machine.
    const finalised = await db.$transaction(async (tx) => {
      const claimed = await tx.quizAttempt.updateMany({
        where: { id: attemptId, completedAt: null },
        data: {
          score: totalScore,
          totalPoints,
          completedAt: new Date(),
        },
      });

      if (claimed.count === 0) return false;

      await tx.quizAnswer.createMany({
        data: answers.map((a) => ({
          attemptId,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
        })),
      });

      return true;
    });

    if (!finalised) {
      return new NextResponse("Quiz already submitted", { status: 409 });
    }

    // Gamification: evaluate badges on quiz completion
    let preTestScore: number | undefined;

    // If this is a post-test, find the pre-test score for growth comparison
    if (attempt.quiz.type === "POST_TEST" && attempt.quiz.courseId) {
      const preTest = await db.quiz.findFirst({
        where: { courseId: attempt.quiz.courseId, type: "PRE_TEST" },
        select: { id: true },
      });
      if (preTest) {
        const bestPreAttempt = await db.quizAttempt.findFirst({
          where: { userId, quizId: preTest.id, completedAt: { not: null } },
          orderBy: { score: "desc" },
          select: { score: true, totalPoints: true },
        });
        if (bestPreAttempt && bestPreAttempt.totalPoints) {
          preTestScore = Math.round(
            (bestPreAttempt.score! / bestPreAttempt.totalPoints) * 100
          );
        }
      }
    }

    const awardedBadges = await evaluateBadges(userId, {
      type: "quiz_completed",
      quizId: routeParams.quizId,
      score: percentage,
      preTestScore,
    });

    return NextResponse.json({
      attemptId,
      score: totalScore,
      totalPoints,
      percentage,
      passed: percentage >= attempt.quiz.passingScore,
      results,
      awardedBadges: awardedBadges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        type: b.type,
      })),
    });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUIZ_SUBMIT", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
