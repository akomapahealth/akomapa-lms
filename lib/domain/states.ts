import {
  BadgeType,
  EnrollmentStatus,
  QuizType,
  ThemePreference,
  TopicContentType,
  UserRole,
} from "@prisma/client";

/**
 * Every closed set of persisted values, in one place (#50).
 *
 * The values themselves are PostgreSQL enums declared in prisma/schema.prisma;
 * the types and value objects below are the generated client's, re-exported so
 * that no other file spells a value list out. A new value is added to the schema
 * and a migration, and the `Record<...>` maps here then fail to compile until
 * every one of them handles it -- which is the point.
 *
 * Client components may import from here: Prisma's browser build carries the
 * enum objects and nothing else.
 */

export { BadgeType, EnrollmentStatus, QuizType, ThemePreference, TopicContentType, UserRole };

/** Every value of an enum object, in declaration order. */
function valuesOf<T extends Record<string, string>>(enumObject: T): readonly T[keyof T][] {
  return Object.freeze(Object.values(enumObject) as T[keyof T][]);
}

export const USER_ROLES = valuesOf(UserRole);
export const TOPIC_CONTENT_TYPES = valuesOf(TopicContentType);
export const ENROLLMENT_STATUSES = valuesOf(EnrollmentStatus);
export const QUIZ_TYPES = valuesOf(QuizType);
export const BADGE_TYPES = valuesOf(BadgeType);
export const THEME_PREFERENCES = valuesOf(ThemePreference);

/**
 * Narrows an untrusted value to a member of a closed set, or null.
 *
 * Exact match only. The free-text columns used to tolerate whatever a caller
 * wrote; a lowercase `"admin"` or a padded `" ACTIVE"` is not a spelling of a
 * known value but evidence of a writer that bypassed validation, and treating it
 * as the value it resembles is how a bypass becomes a grant.
 */
export function parseClosed<T extends string>(
  allowed: readonly T[],
  value: unknown
): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

// ─── Labels: exhaustive by construction ───

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  ADMIN: "Admin",
};

/** Roles that hold privilege above a learner: FACULTY and ADMIN. */
export const STAFF_ROLES: readonly UserRole[] = Object.freeze(
  USER_ROLES.filter((role) => role !== UserRole.STUDENT)
);

/** The badge shown beside a staff member's name; learners get none. */
export function staffBadgeLabel(role: UserRole): string | null {
  return STAFF_ROLES.includes(role) ? ROLE_LABELS[role] : null;
}

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  PRE_TEST: "Pre-Test",
  POST_TEST: "Post-Test",
  MODULE_QUIZ: "Module Quiz",
};

export const TOPIC_CONTENT_TYPE_LABELS: Record<TopicContentType, string> = {
  VIDEO: "Video",
  TEXT: "Text",
  INTERACTIVE: "Interactive",
};

export const BADGE_TYPE_LABELS: Record<BadgeType, string> = {
  COMPLETION: "Completion",
  STREAK: "Streak",
  COMMUNITY: "Community",
  QUIZ_SCORE: "Quiz Score",
  MILESTONE: "Milestone",
};

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

// ─── Enrollment lifecycle ───

/**
 * Which Enrollment status changes are legal (ADR 0002).
 *
 * - ACTIVE -> COMPLETED when the Course is finished (`markCourseCompleted`).
 * - ACTIVE or COMPLETED -> SUSPENDED is the only way access is removed. Access
 *   is never removed by deleting the row.
 * - SUSPENDED -> ACTIVE restores access. A suspended learner does not jump
 *   straight back to COMPLETED; completion is re-established from progress.
 * - COMPLETED -> ACTIVE is refused: completion is not undone by re-enrolling,
 *   which is why `recordPaidEnrollment` never resets an existing status.
 *
 * Staying in the same status is not a transition and is refused, so a caller
 * cannot use a no-op write to look as if it changed something.
 */
export const ENROLLMENT_TRANSITIONS: Record<EnrollmentStatus, readonly EnrollmentStatus[]> = {
  ACTIVE: [EnrollmentStatus.COMPLETED, EnrollmentStatus.SUSPENDED],
  COMPLETED: [EnrollmentStatus.SUSPENDED],
  SUSPENDED: [EnrollmentStatus.ACTIVE],
};

export function canTransitionEnrollment(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  return ENROLLMENT_TRANSITIONS[from].includes(to);
}

/** Thrown for a transition the table above does not allow. */
export class InvalidTransitionError extends Error {
  constructor(
    readonly from: EnrollmentStatus,
    readonly to: EnrollmentStatus
  ) {
    super(`enrollment status cannot change from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertEnrollmentTransition(from: EnrollmentStatus, to: EnrollmentStatus): void {
  if (!canTransitionEnrollment(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * The statuses an Enrollment may move to `to` from, for a conditional write.
 *
 * A status change is written as `updateMany({ where: { status: { in: sources } } })`
 * so that the check and the write are one statement: two concurrent requests
 * cannot both read ACTIVE and both act, and a row that is no longer in a source
 * status is simply not matched.
 */
export function enrollmentSourcesFor(to: EnrollmentStatus): EnrollmentStatus[] {
  return ENROLLMENT_STATUSES.filter((from) => canTransitionEnrollment(from, to));
}

// ─── Persisted columns ───

/**
 * Every column that holds a closed set, with the values it may contain. The
 * migration's verify step and `npm run db:states:preflight` profile exactly
 * these. `table` is the database name: `Topic` is stored as `Chapter`.
 */
export const CLOSED_STATE_COLUMNS = [
  { table: "User", column: "role", allowed: USER_ROLES },
  { table: "Chapter", column: "contentType", allowed: TOPIC_CONTENT_TYPES },
  { table: "Enrollment", column: "status", allowed: ENROLLMENT_STATUSES },
  { table: "Quiz", column: "type", allowed: QUIZ_TYPES },
  { table: "Badge", column: "type", allowed: BADGE_TYPES },
  { table: "UserSettings", column: "theme", allowed: THEME_PREFERENCES },
] as const;

export interface UnexpectedValue {
  column: string;
  /** The stored value, or null for a NULL. Status vocabulary, never personal data. */
  value: string | null;
  rows: number;
}

/**
 * Profiles every closed-state column and returns the values outside its set.
 *
 * `query` runs one SQL statement and returns its rows. Values are read as text,
 * so the same profile works before the migration (text columns) and after it
 * (enum columns, where it should always come back empty).
 */
export async function profileClosedStates(
  query: (sql: string) => Promise<{ value: string | null; rows: number | string }[]>
): Promise<UnexpectedValue[]> {
  const unexpected: UnexpectedValue[] = [];

  for (const { table, column, allowed } of CLOSED_STATE_COLUMNS) {
    // Identifiers come from the constant above, never from input.
    const rows = await query(
      `SELECT "${column}"::text AS value, count(*) AS rows FROM "${table}" GROUP BY 1 ORDER BY 1`
    );
    for (const row of rows) {
      if (row.value === null || !(allowed as readonly string[]).includes(row.value)) {
        unexpected.push({ column: `${table}.${column}`, value: row.value, rows: Number(row.rows) });
      }
    }
  }

  return unexpected;
}
