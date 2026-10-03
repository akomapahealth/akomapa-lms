import "server-only";

import { db } from "@/lib/db";
import { courseHasEntitlementRecords } from "@/lib/entitlement";

/**
 * Whether authored content still carries learners' records (#51).
 *
 * Deleting a Course, Topic, Quiz, Question, or Case Study used to cascade into
 * payments, enrollments, progress, attempts, and the answers grades were
 * computed from. Those foreign keys are RESTRICT now; this module is the check a
 * delete route makes first, so the author gets a 409 with a reason -- and so
 * that external cleanup (Mux assets) happens only for content that is actually
 * going to be deleted. The RESTRICT constraints remain the backstop for a race
 * between this check and the delete.
 *
 * Retention decisions: docs/runbooks/database-integrity.md.
 */

export type LearnerRecordScope =
  | { kind: "course"; courseId: string }
  | { kind: "topic"; topicId: string }
  | { kind: "quiz"; quizId: string }
  | { kind: "question"; questionId: string }
  | { kind: "options"; optionIds: readonly string[] }
  | { kind: "caseStudy"; caseStudyId: string };

/** What the author is told, and what to do instead. Fixed text, safe to show. */
export const LEARNER_RECORDS_CONFLICT: Record<LearnerRecordScope["kind"], string> = {
  course:
    "Learners have enrolled in, paid for, or made progress in this course, so it cannot be deleted. Unpublish it instead.",
  topic:
    "Learners have progress on this topic, so it cannot be deleted. Unpublish it instead.",
  quiz: "Learners have attempted this quiz, so it cannot be deleted. Unpublish it instead.",
  question:
    "Learners have answered this question, so it cannot be deleted without changing their grades.",
  options:
    "Learners have chosen one of these options, so it cannot be removed without changing their grades.",
  caseStudy:
    "Learners have attempted this case study, so it cannot be deleted. Unpublish the topic instead.",
};

const exists = <T>(row: T | null) => row !== null;

/** True when deleting the scope would destroy a learner's or a payment record. */
export async function hasLearnerRecords(scope: LearnerRecordScope): Promise<boolean> {
  switch (scope.kind) {
    case "course": {
      const { courseId } = scope;
      const checks = await Promise.all([
        courseHasEntitlementRecords(courseId),
        db.certificate.findFirst({ where: { courseId }, select: { id: true } }).then(exists),
        db.quizAttempt
          .findFirst({
            where: { quiz: { OR: [{ courseId }, { module: { courseId } }] } },
            select: { id: true },
          })
          .then(exists),
        db.userProgress
          .findFirst({ where: { topic: { module: { courseId } } }, select: { id: true } })
          .then(exists),
        db.caseStudyAttempt
          .findFirst({
            where: { caseStudy: { topic: { module: { courseId } } } },
            select: { id: true },
          })
          .then(exists),
      ]);
      return checks.some(Boolean);
    }

    case "topic": {
      const { topicId } = scope;
      const checks = await Promise.all([
        db.userProgress.findFirst({ where: { topicId }, select: { id: true } }).then(exists),
        db.caseStudyAttempt
          .findFirst({ where: { caseStudy: { topicId } }, select: { id: true } })
          .then(exists),
      ]);
      return checks.some(Boolean);
    }

    case "quiz":
      return exists(
        await db.quizAttempt.findFirst({ where: { quizId: scope.quizId }, select: { id: true } })
      );

    case "question":
      return exists(
        await db.quizAnswer.findFirst({
          where: { questionId: scope.questionId },
          select: { id: true },
        })
      );

    case "options":
      if (scope.optionIds.length === 0) return false;
      return exists(
        await db.quizAnswer.findFirst({
          where: { selectedOptionId: { in: [...scope.optionIds] } },
          select: { id: true },
        })
      );

    case "caseStudy":
      return exists(
        await db.caseStudyAttempt.findFirst({
          where: { caseStudyId: scope.caseStudyId },
          select: { id: true },
        })
      );

    default: {
      // Exhaustive at compile time. At runtime an unknown scope fails closed:
      // reporting records refuses the delete rather than allowing it.
      const unhandled: never = scope;
      void unhandled;
      return true;
    }
  }
}
