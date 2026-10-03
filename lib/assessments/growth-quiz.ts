import "server-only";

import { db } from "@/lib/db";
import { QUIZ_TYPE_LABELS, QuizType } from "@/lib/domain/states";

/**
 * One Pre-Test and one Post-Test per Course (#51).
 *
 * The growth measure compares the two, and every reader -- Certificates, grades,
 * the post-test lock -- takes "the" Pre-Test of a Course. A second one made that
 * choice arbitrary. The partial unique index `Quiz_courseId_growth_type_key`
 * enforces the rule; this is the check routes make first, so the author is told
 * why rather than getting a bare conflict.
 */

const GROWTH_TYPES: readonly QuizType[] = [QuizType.PRE_TEST, QuizType.POST_TEST];

/**
 * The 409 message when `type` would give the Course a second growth Quiz, or
 * null when it would not. `exceptQuizId` is the Quiz being edited, which may
 * keep its own type.
 */
export async function growthQuizConflict(
  courseId: string,
  type: QuizType | undefined,
  exceptQuizId?: string
): Promise<string | null> {
  if (type === undefined || !GROWTH_TYPES.includes(type)) return null;

  const existing = await db.quiz.findFirst({
    where: { courseId, type, ...(exceptQuizId ? { id: { not: exceptQuizId } } : {}) },
    select: { id: true },
  });

  return existing === null
    ? null
    : `This course already has a ${QUIZ_TYPE_LABELS[type]}. Each course has exactly one, because growth is measured between them.`;
}
