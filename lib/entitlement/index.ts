/**
 * Course entitlement (#48, ADR 0002).
 *
 * `Enrollment` is the entitlement; `Purchase` is evidence of payment and never
 * grants access. Import from `@/lib/entitlement` rather than the individual
 * files, and never query `Enrollment` or `Purchase` directly to decide access.
 *
 * `Purchase` remains the right source for payment *history*: revenue reporting
 * in `actions/get-analytics.ts` reads it, and should.
 */
export {
  markCourseCompleted,
  recordFreeEnrollment,
  recordPaidEnrollment,
} from "./enroll";
export {
  courseEntitlement,
  enrollmentStatusFor,
  entitledCourseIds,
  requireCourseAccess,
  topicEntitlement,
} from "./course";
export {
  ENROLLMENT_STATUSES,
  LOCKED_STATE_MESSAGE,
  normalizeEnrollmentStatus,
  type AccessLevel,
  type CourseEntitlement,
  type EnrollmentStatus,
  type EntitlementReason,
  type TopicEntitlement,
} from "./types";
