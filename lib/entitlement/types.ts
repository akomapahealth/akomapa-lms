/**
 * The vocabulary of Course entitlement (#48, ADR 0002).
 *
 * `Enrollment` is the entitlement. `Purchase` is evidence that a payment
 * happened and never grants access on its own. Before this module, eleven call
 * sites each decided for themselves, and they disagreed: a surface reading
 * `Purchase` granted access to a suspended learner, and
 * `actions/get-enrolled-modules.ts` took the union of purchases and enrollments,
 * which is the "OR" ADR 0002 rejects because the weaker condition always wins.
 */

import { ENROLLMENT_STATUSES, EnrollmentStatus, parseClosed } from "../domain/states";

/**
 * `Enrollment.status` values: the schema's `EnrollmentStatus` enum since #50.
 * Re-exported so entitlement callers keep one import; the values and the legal
 * transitions live in lib/domain/states.ts.
 */
export { ENROLLMENT_STATUSES, EnrollmentStatus };

/**
 * Narrows an untrusted status to a known one.
 *
 * The column can no longer hold anything else, but a status arriving by another
 * path -- a raw query, a cached object, a future refactor -- must still not be
 * read as access. `null` means "not a status this system recognises", and every
 * caller treats that as no entitlement.
 */
export function normalizeEnrollmentStatus(value: unknown): EnrollmentStatus | null {
  return parseClosed(ENROLLMENT_STATUSES, value);
}

/**
 * How much of a Course a principal may read.
 *
 * - `full` — the Course and every published Topic in it.
 * - `preview` — only Topics marked `isFree`. A Topic-level exception that never
 *   expands to its Module or Course (ADR 0002 point 4).
 * - `none` — nothing, including free Topics.
 */
export type AccessLevel = "full" | "preview" | "none";

/**
 * Why access is at the level it is.
 *
 * Safe to surface in a locked state: it names the learner's own situation and
 * never anything about another learner, the Course's owner, or the rules.
 */
export type EntitlementReason =
  /** An `ACTIVE` Enrollment. */
  | "active_enrollment"
  /** A `COMPLETED` Enrollment: continued read access, and the Certificate. */
  | "completed_enrollment"
  /** FACULTY who authors this Course, or an ADMIN. */
  | "staff_access"
  /** No Enrollment. Free Topics are still readable. */
  | "not_enrolled"
  /** A `SUSPENDED` Enrollment. Denies access whatever `Purchase` says. */
  | "suspended"
  /** The Course exists but is not published, and the principal is not staff. */
  | "course_unpublished"
  /** No such Course, or a status this system does not recognise. */
  | "course_not_found";

export interface CourseEntitlement {
  level: AccessLevel;
  reason: EntitlementReason;
  /**
   * Whether paid Course content is readable.
   *
   * The single question most call sites ask. Equivalent to `level === "full"`,
   * named so a reader does not have to remember which levels count.
   */
  canLearn: boolean;
  /** The Enrollment status behind the decision, or null when there is none. */
  enrollmentStatus: EnrollmentStatus | null;
}

export interface TopicEntitlement extends CourseEntitlement {
  /** Whether this particular Topic is readable, free preview included. */
  canReadTopic: boolean;
  /** Whether this Topic is a free preview. */
  isFreePreview: boolean;
}

/** Copy for a locked state, keyed by reason. Rendered to learners. */
export const LOCKED_STATE_MESSAGE: Record<EntitlementReason, string> = {
  active_enrollment: "",
  completed_enrollment: "",
  staff_access: "",
  not_enrolled: "Enroll in this course to unlock this content.",
  suspended: "Your access to this course is currently suspended.",
  course_unpublished: "This course is not available yet.",
  course_not_found: "This course is not available.",
};
