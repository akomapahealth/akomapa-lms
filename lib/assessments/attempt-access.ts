import "server-only";

import { db } from "@/lib/db";

/**
 * The Course → Quiz → Attempt relationship (#41).
 *
 * The submit route checked only that the attempt belonged to the caller, then
 * graded against the questions of the Quiz named in the *route*. Those are two
 * different Quizzes whenever the caller says so: an attempt started on one Quiz
 * could be submitted through another Quiz's URL, scoring the attempt against
 * questions it was never issued.
 *
 * Ownership and membership are asserted together, in the query.
 */
export function attemptInQuizAndCourse(
  userId: string,
  courseId: string,
  quizId: string,
  attemptId: string
) {
  return {
    id: attemptId,
    userId,
    quizId,
    quiz: { courseId },
  } as const;
}

/** Loads an attempt only if it is the learner's, on this Quiz, in this Course. */
export async function findLearnerAttempt(
  userId: string,
  courseId: string,
  quizId: string,
  attemptId: string
) {
  return db.quizAttempt.findFirst({
    where: attemptInQuizAndCourse(userId, courseId, quizId, attemptId),
    include: {
      quiz: {
        select: { timeLimitMinutes: true, passingScore: true, type: true, courseId: true },
      },
    },
  });
}
