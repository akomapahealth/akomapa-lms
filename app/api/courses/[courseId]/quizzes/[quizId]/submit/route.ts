import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { quizParams } from "@/lib/validations/ids";
import { submissionSchema } from "@/lib/validations/quiz";
import { findLearnerAttempt } from "@/lib/assessments/attempt-access";
import { gradeSubmission, validateSubmission } from "@/lib/assessments/grading";
import { evaluateBadges } from "@/lib/badge-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    const routeParams = parseParams(quizParams, await params);

    const { userId } = await requirePrincipal();

    // Ids are uuids and no question may be answered twice. The previous schema
    // accepted any non-empty string for each id, and a duplicated questionId
    // created two QuizAnswer rows for one question and double-counted its score.
    const { attemptId, answers } = await parseBody(submissionSchema, req);

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
      return problem("not_found");
    }

    if (attempt.completedAt) {
      return problem("conflict", { message: "This attempt is already submitted." });
    }

    // Server-side time validation (30s grace period)
    if (attempt.quiz.timeLimitMinutes) {
      const elapsed = (Date.now() - attempt.startedAt.getTime()) / 1000;
      const allowedSeconds = attempt.quiz.timeLimitMinutes * 60 + 30;
      if (elapsed > allowedSeconds) {
        return problem("conflict", {
          message: "The time limit for this attempt has passed.",
        });
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
      // Well-formed but not answerable: the ids are uuids and unique, they just
      // do not belong to this Quiz. Field-level, without naming which id failed.
      return problem("validation_failed", {
        fields: [{ path: "answers", code: "not_in_quiz" }],
      });
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
      return problem("conflict", { message: "This attempt is already submitted." });
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
    return handleRouteError("QUIZ_SUBMIT", error);
  }
}
