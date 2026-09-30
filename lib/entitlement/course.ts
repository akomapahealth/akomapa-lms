import "server-only";

import { can, Denied, type Principal } from "@/lib/auth";
import { db } from "@/lib/db";

import {
  normalizeEnrollmentStatus,
  type CourseEntitlement,
  type EnrollmentStatus,
  type TopicEntitlement,
} from "./types";

/**
 * The one place that answers "may this principal read this Course" (#48).
 *
 * Nothing else queries `Enrollment` or `Purchase` to make an access decision.
 * `Purchase` is not read here at all: it is evidence of payment, and payment is
 * an input that *creates* an Enrollment in the Stripe path, never a substitute
 * for one (ADR 0002 point 3).
 */

/** The Course facts an entitlement decision needs. */
interface CourseFacts {
  ownerId: string;
  isPublished: boolean;
}

/**
 * Whether the principal reaches this Course as staff.
 *
 * ADR 0002 lists staff assignment and administration as entitlement sources, and
 * `docs/permission-matrix.md` defers the full rule to this issue. Two routes in:
 * a FACULTY member who authors the Course, which `course:read` already encodes as
 * `facultyOwned`; and an ADMIN, who may reach any Course in order to support a
 * learner or review content. Neither survives a suspension -- see the ordering in
 * `courseEntitlement`.
 */
function isStaffFor(principal: Principal, course: CourseFacts): boolean {
  return (
    can(principal, "course:read", { kind: "course", ownerId: course.ownerId }) ||
    can(principal, "learner:administer")
  );
}

/**
 * The entitlement decision for one Course.
 *
 * The order of the checks is the decision, so it is written out rather than left
 * to fall out of the control flow:
 *
 * 1. **No Course** — nothing to be entitled to.
 * 2. **`SUSPENDED`** — denied, before staff is considered. "Privilege does not
 *    buy back a suspension: an ADMIN with a `SUSPENDED` Enrollment is denied"
 *    (docs/permission-matrix.md).
 * 3. **Staff** — full access, including to an unpublished Course, because an
 *    author has to be able to read what they are writing.
 * 4. **Unpublished** — denied to everyone else, free Topics included. A draft
 *    Course is not a preview.
 * 5. **`ACTIVE` or `COMPLETED`** — full access. `COMPLETED` keeps read access to
 *    the Course and its Certificate (ADR 0002 point 2).
 * 6. **Otherwise** — preview. Free Topics only.
 */
export async function courseEntitlement(
  principal: Principal | null | undefined,
  courseId: string
): Promise<CourseEntitlement> {
  const none = (reason: CourseEntitlement["reason"], status: EnrollmentStatus | null = null) =>
    ({ level: "none", reason, canLearn: false, enrollmentStatus: status }) as const;

  // An absent principal is never entitled. Checked before the query so an
  // unauthenticated request cannot be used to probe which Course ids exist.
  if (!principal) return none("course_not_found");

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { userId: true, isPublished: true },
  });

  if (!course) return none("course_not_found");

  const facts: CourseFacts = { ownerId: course.userId, isPublished: course.isPublished };

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: principal.userId, courseId } },
    select: { status: true },
  });

  // An unrecognised status is not a status. It must not be read as access, and it
  // must not be read as "no enrollment" either, because that would silently
  // downgrade a suspension to a preview.
  const status = enrollment === null ? null : normalizeEnrollmentStatus(enrollment.status);
  if (enrollment !== null && status === null) return none("course_not_found");

  if (status === "SUSPENDED") return none("suspended", status);

  if (isStaffFor(principal, facts)) {
    return { level: "full", reason: "staff_access", canLearn: true, enrollmentStatus: status };
  }

  if (!facts.isPublished) return none("course_unpublished", status);

  // The suspension invariant itself lives in the permission module, so there is
  // one implementation of it rather than a copy here.
  if (status !== null && can(principal, "course:learn", { kind: "enrollment", status })) {
    return {
      level: "full",
      reason: status === "COMPLETED" ? "completed_enrollment" : "active_enrollment",
      canLearn: true,
      enrollmentStatus: status,
    };
  }

  return { level: "preview", reason: "not_enrolled", canLearn: false, enrollmentStatus: status };
}

/**
 * The entitlement decision for one Topic in one Course.
 *
 * The Topic must be published and reached through a Module of this Course --
 * the binding from #39 -- so a Topic id from elsewhere cannot borrow this
 * Course's entitlement.
 */
export async function topicEntitlement(
  principal: Principal | null | undefined,
  courseId: string,
  topicId: string
): Promise<TopicEntitlement> {
  const entitlement = await courseEntitlement(principal, courseId);

  const topic = await db.topic.findFirst({
    where: { id: topicId, isPublished: true, module: { courseId } },
    select: { isFree: true },
  });

  if (!topic) {
    return { ...entitlement, canReadTopic: false, isFreePreview: false };
  }

  // A free Topic is readable at `preview`, but never at `none`: a suspension, an
  // unpublished Course, and a missing Course all close the free door too.
  const canReadTopic =
    entitlement.level === "full" || (entitlement.level === "preview" && topic.isFree);

  return { ...entitlement, canReadTopic, isFreePreview: topic.isFree };
}

/**
 * The Courses a principal may learn, as ids.
 *
 * For list surfaces: the dashboard, `/courses`, grades, and the Course picker on
 * a new Community post. `SUSPENDED` is excluded, which is the whole point --
 * these lists were built from `Purchase`, so a suspended learner still saw every
 * Course they had paid for.
 *
 * Staff are not given every Course here. Staff entitlement exists so an author
 * can read their own draft, not so the learner dashboard fills up with the
 * catalogue.
 */
export async function entitledCourseIds(
  principal: Principal | null | undefined
): Promise<string[]> {
  if (!principal) return [];

  const enrollments = await db.enrollment.findMany({
    where: { userId: principal.userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { courseId: true },
  });

  return enrollments.map((enrollment) => enrollment.courseId);
}

/**
 * The Enrollment status for a known learner and Course, normalized.
 *
 * For the places that need the status itself rather than a full decision, and
 * that have a user id rather than a `Principal` -- certificate issuance, which
 * turns on `COMPLETED` specifically. Keeping it here means the status literals and
 * the normalization live in one module, so a feature never compares
 * `status === "COMPLETED"` against a raw column itself.
 */
export async function enrollmentStatusFor(
  userId: string,
  courseId: string
): Promise<EnrollmentStatus | null> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });

  return enrollment === null ? null : normalizeEnrollmentStatus(enrollment.status);
}

/**
 * The entitlement, or a denial.
 *
 * For a route handler that has nothing to say when access is absent. Answers
 * `not_found` rather than `forbidden`, so the endpoint cannot be used to
 * enumerate Courses the caller is not on.
 */
export async function requireCourseAccess(
  principal: Principal | null | undefined,
  courseId: string
): Promise<CourseEntitlement> {
  const entitlement = await courseEntitlement(principal, courseId);
  if (!entitlement.canLearn) throw new Denied("not_found", "course:learn");
  return entitlement;
}
