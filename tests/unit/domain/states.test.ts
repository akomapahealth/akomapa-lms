import { describe, expect, it } from "vitest";

import {
  assertEnrollmentTransition,
  BADGE_TYPE_LABELS,
  BADGE_TYPES,
  canTransitionEnrollment,
  CLOSED_STATE_COLUMNS,
  ENROLLMENT_STATUSES,
  ENROLLMENT_TRANSITIONS,
  enrollmentSourcesFor,
  EnrollmentStatus,
  InvalidTransitionError,
  parseClosed,
  profileClosedStates,
  QUIZ_TYPE_LABELS,
  QUIZ_TYPES,
  QuizType,
  ROLE_LABELS,
  STAFF_ROLES,
  staffBadgeLabel,
  THEME_LABELS,
  THEME_PREFERENCES,
  TOPIC_CONTENT_TYPE_LABELS,
  TOPIC_CONTENT_TYPES,
  USER_ROLES,
  UserRole,
} from "@/lib/domain/states";

import { read } from "../support/source-scan";

describe("the closed sets", () => {
  it("are exactly the values the schema declares", () => {
    // A value added to or removed from schema.prisma changes these; the test
    // makes that a reviewed change rather than a silent one.
    expect(USER_ROLES).toEqual(["STUDENT", "FACULTY", "ADMIN"]);
    expect(TOPIC_CONTENT_TYPES).toEqual(["VIDEO", "TEXT", "INTERACTIVE"]);
    expect(ENROLLMENT_STATUSES).toEqual(["ACTIVE", "COMPLETED", "SUSPENDED"]);
    expect(QUIZ_TYPES).toEqual(["PRE_TEST", "POST_TEST", "MODULE_QUIZ"]);
    expect(BADGE_TYPES).toEqual(["COMPLETION", "STREAK", "COMMUNITY", "QUIZ_SCORE", "MILESTONE"]);
    expect(THEME_PREFERENCES).toEqual(["light", "dark", "system"]);
  });

  it("are frozen", () => {
    expect(Object.isFrozen(USER_ROLES)).toBe(true);
  });

  it.each([
    ["roles", ROLE_LABELS, USER_ROLES],
    ["quiz types", QUIZ_TYPE_LABELS, QUIZ_TYPES],
    ["content types", TOPIC_CONTENT_TYPE_LABELS, TOPIC_CONTENT_TYPES],
    ["badge types", BADGE_TYPE_LABELS, BADGE_TYPES],
    ["themes", THEME_LABELS, THEME_PREFERENCES],
  ] as const)("label every one of the %s", (_label, labels, values) => {
    expect(Object.keys(labels).sort()).toEqual([...values].sort());
    for (const value of values) {
      expect((labels as Record<string, string>)[value].length).toBeGreaterThan(0);
    }
  });

  it("cannot be labelled partially -- a missing member fails to compile", () => {
    // Checked by `npm run typecheck`, not at runtime: each expect-error
    // directive below fails the build if its line ever stops being an error.
    // @ts-expect-error MODULE_QUIZ is missing
    const partial: Record<QuizType, string> = { PRE_TEST: "a", POST_TEST: "b" };
    // @ts-expect-error a value outside the set is not a QuizType
    const stray: QuizType = "FINAL_EXAM";
    expect([partial, stray]).toHaveLength(2);
  });
});

describe("parseClosed", () => {
  it.each(["STUDENT", "FACULTY", "ADMIN"])("accepts %s", (value) => {
    expect(parseClosed(USER_ROLES, value)).toBe(value);
  });

  it.each([
    ["lowercase", "admin"],
    ["mixed case", "Admin"],
    ["padding", " ADMIN"],
    ["a trailing newline", "ADMIN\n"],
    ["a near miss", "ADMINS"],
    ["empty", ""],
    ["a number", 1],
    ["null", null],
    ["undefined", undefined],
    ["an object", { role: "ADMIN" }],
    ["an array", ["ADMIN"]],
  ])("refuses %s rather than coercing it", (_label, value) => {
    // The old free-text columns tolerated spelling; a near miss is a writer
    // that bypassed validation, not a role.
    expect(parseClosed(USER_ROLES, value)).toBeNull();
  });
});

describe("staffBadgeLabel", () => {
  it("defines staff as every role above a learner", () => {
    expect(STAFF_ROLES).toEqual(["FACULTY", "ADMIN"]);
  });

  it("labels staff and leaves learners unlabelled", () => {
    expect(staffBadgeLabel(UserRole.ADMIN)).toBe("Admin");
    expect(staffBadgeLabel(UserRole.FACULTY)).toBe("Faculty");
    expect(staffBadgeLabel(UserRole.STUDENT)).toBeNull();
  });
});

describe("Enrollment transitions", () => {
  const { ACTIVE, COMPLETED, SUSPENDED } = EnrollmentStatus;

  it.each([
    [ACTIVE, COMPLETED, true],
    [ACTIVE, SUSPENDED, true],
    [COMPLETED, SUSPENDED, true],
    [SUSPENDED, ACTIVE, true],
    // Completion is not undone by re-enrolling.
    [COMPLETED, ACTIVE, false],
    // A suspended learner does not jump straight to COMPLETED.
    [SUSPENDED, COMPLETED, false],
    // Staying put is not a transition.
    [ACTIVE, ACTIVE, false],
    [COMPLETED, COMPLETED, false],
    [SUSPENDED, SUSPENDED, false],
  ] as const)("%s -> %s is %s", (from, to, allowed) => {
    expect(canTransitionEnrollment(from, to)).toBe(allowed);
  });

  it("covers every pair, so no transition is decided by omission", () => {
    expect(Object.keys(ENROLLMENT_TRANSITIONS).sort()).toEqual([...ENROLLMENT_STATUSES].sort());
  });

  it("throws a typed error for an invalid transition", () => {
    expect(() => assertEnrollmentTransition(COMPLETED, ACTIVE)).toThrow(InvalidTransitionError);
    try {
      assertEnrollmentTransition(SUSPENDED, COMPLETED);
    } catch (error) {
      expect(error).toMatchObject({ from: SUSPENDED, to: COMPLETED, name: "InvalidTransitionError" });
    }
    expect(() => assertEnrollmentTransition(ACTIVE, COMPLETED)).not.toThrow();
  });

  it.each([
    [COMPLETED, [ACTIVE]],
    [SUSPENDED, [ACTIVE, COMPLETED]],
    [ACTIVE, [SUSPENDED]],
  ] as const)("lists the sources a write to %s may match", (to, sources) => {
    expect(enrollmentSourcesFor(to)).toEqual(sources);
  });
});

describe("profileClosedStates", () => {
  type Rows = { value: string | null; rows: number | string }[];

  function fakeDatabase(byTable: Record<string, Rows>) {
    const statements: string[] = [];
    const query = async (sql: string) => {
      statements.push(sql);
      const table = sql.match(/FROM "(\w+)"/)![1];
      return byTable[table] ?? [];
    };
    return { query, statements };
  }

  it("reports nothing for a clean database", async () => {
    const { query } = fakeDatabase({
      User: [{ value: "ADMIN", rows: "1" }, { value: "STUDENT", rows: "40" }],
      Badge: [{ value: "STREAK", rows: 2 }],
    });

    expect(await profileClosedStates(query)).toEqual([]);
  });

  it("reports every unexpected value with its column and count, NULL included", async () => {
    const { query } = fakeDatabase({
      User: [{ value: "STUDENT", rows: "3" }, { value: "teacher", rows: "2" }],
      Enrollment: [{ value: "active", rows: "1" }, { value: null, rows: "4" }],
      UserSettings: [{ value: "Dark", rows: "1" }],
    });

    expect(await profileClosedStates(query)).toEqual([
      { column: "User.role", value: "teacher", rows: 2 },
      { column: "Enrollment.status", value: "active", rows: 1 },
      { column: "Enrollment.status", value: null, rows: 4 },
      { column: "UserSettings.theme", value: "Dark", rows: 1 },
    ]);
  });

  it("profiles every closed-state column, reading values as text", async () => {
    const { query, statements } = fakeDatabase({});
    await profileClosedStates(query);

    expect(statements).toHaveLength(CLOSED_STATE_COLUMNS.length);
    expect(statements[0]).toBe(
      'SELECT "role"::text AS value, count(*) AS rows FROM "User" GROUP BY 1 ORDER BY 1'
    );
    // Topic is stored as Chapter.
    expect(statements.some((sql) => sql.includes('FROM "Chapter"'))).toBe(true);
  });
});

describe("the migration's verify step", () => {
  const sql = read("prisma/migrations/20261003010000_closed_domain_states/migration.sql");

  it.each(CLOSED_STATE_COLUMNS.map((c) => [`${c.table}.${c.column}`, c] as const))(
    "checks %s against exactly the canonical values",
    (_label, { table, column, allowed }) => {
      const list = allowed.map((value) => `'${value}'`).join(", ");
      expect(sql).toContain(`FROM "${table}"\n     WHERE "${column}" IS NULL OR "${column}" NOT IN (${list})`);
    }
  );

  it("creates each enum with exactly the canonical values", () => {
    for (const [type, values] of [
      ["UserRole", USER_ROLES],
      ["TopicContentType", TOPIC_CONTENT_TYPES],
      ["EnrollmentStatus", ENROLLMENT_STATUSES],
      ["QuizType", QUIZ_TYPES],
      ["BadgeType", BADGE_TYPES],
      ["ThemePreference", THEME_PREFERENCES],
    ] as const) {
      expect(sql).toContain(
        `CREATE TYPE "${type}" AS ENUM (${values.map((v) => `'${v}'`).join(", ")});`
      );
    }
  });

  it("converts in place and never drops a column", () => {
    // `prisma migrate diff` proposes DROP COLUMN + ADD COLUMN, which would
    // discard every value. The hand-written migration must not. Comments are
    // stripped first: the header explains exactly this.
    const statements = sql.replace(/--.*$/gm, "");
    expect(statements).not.toMatch(/DROP COLUMN/i);
    expect(statements.match(/ALTER COLUMN "\w+" TYPE "\w+" USING/g)).toHaveLength(6);
  });
});
