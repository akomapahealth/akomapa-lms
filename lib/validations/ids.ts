import { z } from "zod";

import { TEXT } from "@/lib/http/limits";

/**
 * Identifier schemas for route params and body references (#44).
 *
 * Every model in `prisma/schema.prisma` declares `@default(uuid())` except
 * `User`, whose id is the Clerk subject. So every path segment in the API is a
 * uuid, and validating that before a query is both free and worth doing: an
 * unvalidated id reaches PostgreSQL as an arbitrary string, where it is at best
 * a wasted round trip and at worst a driver error surfacing as a 500.
 */

/** Any resource id the API accepts in a path or a body. */
export const resourceId = z.string().uuid();

/**
 * A Clerk user id, e.g. `user_2abcDEF...`.
 *
 * Not a uuid. Only webhooks and Stripe metadata carry one in a payload; every
 * other route derives the principal server-side and never reads it from input.
 */
export const clerkUserId = z
  .string()
  .min(1)
  .max(TEXT.token)
  .regex(/^user_[A-Za-z0-9]+$/, { message: "invalid_clerk_id" });

/**
 * Route param schemas, one per path shape.
 *
 * `.strict()` throughout: Next.js supplies exactly the segments the file path
 * declares, so an extra key means the handler and its schema have drifted apart,
 * which is worth a loud failure in development rather than a silent pass.
 */
export const courseParams = z.object({ courseId: resourceId }).strict();

export const topicParams = z
  .object({ courseId: resourceId, chapterId: resourceId })
  .strict();

export const attachmentParams = z
  .object({ courseId: resourceId, attachmentId: resourceId })
  .strict();

export const quizParams = z
  .object({ courseId: resourceId, quizId: resourceId })
  .strict();

export const questionParams = z
  .object({ courseId: resourceId, quizId: resourceId, questionId: resourceId })
  .strict();

export const attemptParams = z
  .object({ courseId: resourceId, quizId: resourceId, attemptId: resourceId })
  .strict();

export const caseStudyParams = z
  .object({ courseId: resourceId, caseStudyId: resourceId })
  .strict();

/**
 * The case study attempt route's own params.
 *
 * Its file path is nested under `[courseId]` but the handler only ever used
 * `caseStudyId`, so the Course was never checked. #85 owns binding the attempt
 * to the Course; validating both segments here at least means neither can be a
 * non-uuid, and the schema records that `courseId` is present and unused.
 */
export const caseStudyAttemptParams = z
  .object({ courseId: resourceId, caseStudyId: resourceId })
  .strict();

export const postParams = z.object({ postId: resourceId }).strict();
export const commentParams = z.object({ commentId: resourceId }).strict();
export const categoryParams = z.object({ categoryId: resourceId }).strict();
export const journalEntryParams = z.object({ entryId: resourceId }).strict();
