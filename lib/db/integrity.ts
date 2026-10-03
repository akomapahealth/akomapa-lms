/**
 * Invariants the database enforces beyond types and foreign keys (#51).
 *
 * One list, read by three things that must agree: the migration that creates
 * the constraints (20261003050000_integrity_constraints), the read-only
 * preflight that reports rows which would violate them
 * (`npm run db:integrity:preflight`), and the tests that check the two match.
 *
 * Prisma cannot express CHECK constraints, triggers, or partial unique indexes,
 * and does not see them, so the drift check leaves them alone; this list is
 * where they are written down instead.
 */

export interface CheckConstraint {
  /** The constraint's name in PostgreSQL. */
  name: string;
  table: string;
  /** The condition every row must satisfy, as SQL. */
  condition: string;
  /** Why, in a sentence. */
  reason: string;
}

export const CHECK_CONSTRAINTS: readonly CheckConstraint[] = [
  {
    name: "Course_price_non_negative",
    table: "Course",
    condition: `"price" IS NULL OR "price" >= 0`,
    reason: "A negative price would credit the learner at checkout.",
  },
  {
    name: "Quiz_passingScore_percentage",
    table: "Quiz",
    condition: `"passingScore" >= 0 AND "passingScore" <= 100`,
    reason: "The passing score is a percentage; outside 0-100 a Quiz cannot be passed, or cannot be failed.",
  },
  {
    name: "Quiz_timeLimitMinutes_positive",
    table: "Quiz",
    condition: `"timeLimitMinutes" IS NULL OR "timeLimitMinutes" > 0`,
    reason: "A zero or negative time limit expires every attempt at once; no limit is NULL.",
  },
  {
    name: "Question_points_non_negative",
    table: "Question",
    condition: `"points" >= 0`,
    reason: "Negative points would subtract from a correct answer's total.",
  },
  {
    name: "QuizAttempt_score_within_total",
    table: "QuizAttempt",
    condition: `("totalPoints" IS NULL OR "totalPoints" >= 0) AND ("score" IS NULL OR ("score" >= 0 AND ("totalPoints" IS NULL OR "score" <= "totalPoints")))`,
    reason: "A score above the total, or below zero, is a grading fault that would flow into Certificates.",
  },
  {
    name: "LearningStreak_counts_consistent",
    table: "LearningStreak",
    condition: `"currentStreak" >= 0 AND "longestStreak" >= "currentStreak"`,
    reason: "The longest streak can never be shorter than the current one.",
  },
  {
    name: "Module_position_non_negative",
    table: "Module",
    condition: `"position" >= 0`,
    reason: "Positions are ordinals; reorders park rows above the maximum, never below zero.",
  },
  {
    name: "Chapter_position_non_negative",
    table: "Chapter",
    condition: `"position" >= 0`,
    reason: "As above, for Topics.",
  },
  {
    name: "Question_position_non_negative",
    table: "Question",
    condition: `"position" >= 0`,
    reason: "As above, for Questions.",
  },
  {
    name: "QuestionOption_position_non_negative",
    table: "QuestionOption",
    condition: `"position" >= 0`,
    reason: "As above, for answer options.",
  },
];

export interface ImmutableColumns {
  table: string;
  columns: readonly string[];
  reason: string;
}

/**
 * Columns that identify a record and must never change after it is written.
 * A BEFORE UPDATE trigger refuses any change. No application path updates
 * them; this makes sure none ever can, including a raw query or a future bug.
 */
export const IMMUTABLE_COLUMNS: readonly ImmutableColumns[] = [
  {
    table: "Certificate",
    columns: ["certificateNumber", "userId", "courseId"],
    reason: "A Certificate number is permanently verifiable at /verify; re-pointing it would forge a credential.",
  },
  {
    table: "Purchase",
    columns: ["userId", "courseId"],
    reason: "Payment evidence must keep describing the payment that happened.",
  },
  {
    table: "Enrollment",
    columns: ["userId", "courseId"],
    reason: "An entitlement moves between states, never between learners or Courses.",
  },
  {
    table: "QuizAttempt",
    columns: ["userId", "quizId"],
    reason: "A grade belongs to one learner's attempt at one Quiz.",
  },
  {
    table: "UserProgress",
    columns: ["userId", "chapterId"],
    reason: "Progress belongs to one learner on one Topic.",
  },
];

/** The function every immutability trigger calls. */
export const IMMUTABILITY_FUNCTION = "akomapa_refuse_identifier_change";

/** Trigger name for a table's immutability trigger. */
export function immutabilityTrigger(table: string): string {
  return `${table}_identifiers_immutable`;
}

/**
 * One Pre-Test and one Post-Test per Course: the growth measure compares the
 * two, and every reader (Certificates, grades, the post-test lock) takes "the"
 * Pre-Test with `find`. A partial unique index enforces it.
 */
export const SINGLE_GROWTH_QUIZ_INDEX = "Quiz_courseId_growth_type_key";

/** Tables whose positions are unique per parent (migration 20261003030000). */
export const ORDERED_TABLES = [
  { table: "Module", parent: "courseId" },
  { table: "Chapter", parent: "moduleId" },
  { table: "Question", parent: "quizId" },
  { table: "QuestionOption", parent: "questionId" },
] as const;

export interface IntegrityFinding {
  /** A constraint name, `<table>.position`, or the growth-quiz index. */
  rule: string;
  /** Rows (or, for positions and growth Quizzes, parents) affected. */
  count: number;
  /** What deploying would do about it. */
  effect: "renumbered by the migration" | "blocks the migration";
}

/**
 * Profiles a database against every rule above, read-only.
 *
 * Duplicate positions are reported but do not block: the ordering migration
 * renumbers them, keeping their order. Range violations and duplicate growth
 * Quizzes block the integrity migration until a person resolves them.
 */
export async function profileIntegrity(
  query: (sql: string) => Promise<{ n: number | string }[]>
): Promise<IntegrityFinding[]> {
  const findings: IntegrityFinding[] = [];
  const count = async (sql: string) => Number((await query(sql))[0]?.n ?? 0);

  for (const { table, parent } of ORDERED_TABLES) {
    const n = await count(
      `SELECT count(DISTINCT "${parent}") AS n FROM (SELECT "${parent}" FROM "${table}" GROUP BY "${parent}", "position" HAVING count(*) > 1) AS d`
    );
    if (n > 0) findings.push({ rule: `${table}.position`, count: n, effect: "renumbered by the migration" });
  }

  for (const check of CHECK_CONSTRAINTS) {
    const n = await count(`SELECT count(*) AS n FROM "${check.table}" WHERE NOT (${check.condition})`);
    if (n > 0) findings.push({ rule: check.name, count: n, effect: "blocks the migration" });
  }

  const growth = await count(
    `SELECT count(*) AS n FROM (SELECT "courseId", "type" FROM "Quiz" WHERE "type"::text IN ('PRE_TEST', 'POST_TEST') AND "courseId" IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1) AS d`
  );
  if (growth > 0) {
    findings.push({ rule: SINGLE_GROWTH_QUIZ_INDEX, count: growth, effect: "blocks the migration" });
  }

  return findings;
}
