import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminConnectionString, withDatabase } from "./support/database-url";
import { testDb, testPool } from "./support/db";
import { aCourseWithTopic, aUserRow } from "./support/fixtures";

vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const { CLOSED_STATE_COLUMNS, profileClosedStates } = await import("@/lib/domain/states");
const { markCourseCompleted } = await import("@/lib/entitlement");

/**
 * The closed-state migration and its constraints, against real PostgreSQL (#50).
 *
 * The upgrade cases build their own database at the state before #50 by
 * applying every earlier committed migration, then plant legacy rows and run
 * the real migration file over them. That is the only way to prove what the
 * migration does to data it did not create.
 */

const MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations");
const TARGET = "20261003010000_closed_domain_states";
const ROLLBACK = path.resolve(
  __dirname,
  "../../scripts/sql/rollback-20261003010000-closed-domain-states.sql"
);

// eslint-disable-next-line security/detect-non-literal-fs-filename -- repository paths
const migrationNames = readdirSync(MIGRATIONS)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
const before = migrationNames.slice(0, migrationNames.indexOf(TARGET));

function sqlOf(name: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository paths
  return readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8");
}

/** Prisma applies each migration inside a transaction; so does this. */
async function applyInTransaction(client: Client, sql: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function columnType(client: Client, table: string, column: string): Promise<string> {
  const { rows } = await client.query(
    `SELECT udt_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows[0].udt_name;
}

/** Every legal value, planted as text before the migration runs. */
async function plantEveryLegacyValue(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO "User" (id, role, "updatedAt") VALUES
      ('u_student', 'STUDENT', now()), ('u_faculty', 'FACULTY', now()), ('u_admin', 'ADMIN', now()),
      ('u_default', DEFAULT, now());
    INSERT INTO "Course" (id, "userId", title, "updatedAt") VALUES ('c1', 'u_faculty', 'Ethics', now());
    INSERT INTO "Module" (id, "courseId", title, position, "updatedAt") VALUES ('m1', 'c1', 'M', 1, now());
    INSERT INTO "Chapter" (id, "moduleId", title, position, "contentType", "updatedAt") VALUES
      ('t_video', 'm1', 'V', 1, 'VIDEO', now()), ('t_text', 'm1', 'T', 2, 'TEXT', now()),
      ('t_inter', 'm1', 'I', 3, 'INTERACTIVE', now()), ('t_default', 'm1', 'D', 4, DEFAULT, now());
    INSERT INTO "Enrollment" (id, "userId", "courseId", status, "updatedAt") VALUES
      ('e_active', 'u_student', 'c1', 'ACTIVE', now()),
      ('e_done', 'u_admin', 'c1', 'COMPLETED', now()),
      ('e_susp', 'u_default', 'c1', 'SUSPENDED', now());
    INSERT INTO "Quiz" (id, "courseId", title, type, "updatedAt") VALUES
      ('q_pre', 'c1', 'Pre', 'PRE_TEST', now()), ('q_post', 'c1', 'Post', 'POST_TEST', now()),
      ('q_mod', 'c1', 'Mod', 'MODULE_QUIZ', now());
    INSERT INTO "Badge" (id, name, description, type, criteria, "updatedAt") VALUES
      ('b1', 'B1', 'd', 'COMPLETION', '{}', now()), ('b2', 'B2', 'd', 'STREAK', '{}', now()),
      ('b3', 'B3', 'd', 'COMMUNITY', '{}', now()), ('b4', 'B4', 'd', 'QUIZ_SCORE', '{}', now()),
      ('b5', 'B5', 'd', 'MILESTONE', '{}', now());
    INSERT INTO "UserSettings" (id, "userId", theme, "updatedAt") VALUES
      ('s1', 'u_student', 'light', now()), ('s2', 'u_faculty', 'dark', now()),
      ('s3', 'u_admin', 'system', now()), ('s4', 'u_default', DEFAULT, now());
  `);
}

async function snapshot(client: Client): Promise<string[]> {
  const parts: string[] = [];
  for (const { table, column } of CLOSED_STATE_COLUMNS) {
    const { rows } = await client.query(
      `SELECT id, "${column}"::text AS value FROM "${table}" ORDER BY id`
    );
    parts.push(...rows.map((r) => `${table}.${column} ${r.id}=${r.value}`));
  }
  return parts;
}

describe("upgrading a pre-#50 database", () => {
  const admin = adminConnectionString();
  const name = `akomapa_integration_upgrade_${process.env.VITEST_WORKER_ID ?? "0"}`;
  let client: Client;

  beforeEach(async () => {
    const maintenance = new Client({ connectionString: withDatabase(admin, "postgres") });
    await maintenance.connect();
    await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);
    await maintenance.query(`CREATE DATABASE "${name}"`);
    await maintenance.end();

    client = new Client({ connectionString: withDatabase(admin, name) });
    await client.connect();
    for (const migration of before) await applyInTransaction(client, sqlOf(migration));
  }, 60_000);

  afterEach(async () => {
    await client.end();
    const maintenance = new Client({ connectionString: withDatabase(admin, "postgres") });
    await maintenance.connect();
    await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);
    await maintenance.end();
  });

  it("starts from text columns", async () => {
    expect(await columnType(client, "User", "role")).toBe("text");
  });

  it("converts every legacy value to itself and keeps the defaults", async () => {
    await plantEveryLegacyValue(client);
    const original = await snapshot(client);

    await applyInTransaction(client, sqlOf(TARGET));

    expect(await snapshot(client)).toEqual(original);
    expect(await columnType(client, "User", "role")).toBe("UserRole");
    expect(await columnType(client, "Chapter", "contentType")).toBe("TopicContentType");
    expect(await columnType(client, "Enrollment", "status")).toBe("EnrollmentStatus");
    expect(await columnType(client, "Quiz", "type")).toBe("QuizType");
    expect(await columnType(client, "Badge", "type")).toBe("BadgeType");
    expect(await columnType(client, "UserSettings", "theme")).toBe("ThemePreference");

    await client.query(`INSERT INTO "User" (id, "updatedAt") VALUES ('u_new', now())`);
    const { rows } = await client.query(`SELECT role FROM "User" WHERE id = 'u_new'`);
    expect(rows[0].role).toBe("STUDENT");
  });

  it("converts an empty database", async () => {
    await expect(applyInTransaction(client, sqlOf(TARGET))).resolves.toBeUndefined();
  });

  it("aborts on unexpected values, reports each one, and changes nothing", async () => {
    await plantEveryLegacyValue(client);
    await client.query(`
      UPDATE "User" SET role = 'teacher' WHERE id = 'u_faculty';
      UPDATE "User" SET role = 'admin' WHERE id = 'u_admin';
      UPDATE "Enrollment" SET status = ' ACTIVE' WHERE id = 'e_active';
      UPDATE "UserSettings" SET theme = 'Dark' WHERE id = 's2';
    `);
    const original = await snapshot(client);

    const failure = await applyInTransaction(client, sqlOf(TARGET)).catch((error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("unexpected legacy values; nothing was changed");
    expect(message).toContain("User.role = 'teacher' (1 rows)");
    expect(message).toContain("User.role = 'admin' (1 rows)");
    expect(message).toContain("Enrollment.status = ' ACTIVE' (1 rows)");
    expect(message).toContain("UserSettings.theme = 'Dark' (1 rows)");

    // Nothing coerced, nothing half-applied: no types, text columns, same rows.
    expect(await snapshot(client)).toEqual(original);
    expect(await columnType(client, "User", "role")).toBe("text");
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM pg_type WHERE typname = 'UserRole'`);
    expect(rows[0].n).toBe(0);
  });

  it("reports the same values in the read-only preflight", async () => {
    await plantEveryLegacyValue(client);
    await client.query(`UPDATE "Quiz" SET type = 'FINAL' WHERE id = 'q_mod'`);

    const unexpected = await profileClosedStates(async (sql) => (await client.query(sql)).rows);

    expect(unexpected).toEqual([{ column: "Quiz.type", value: "FINAL", rows: 1 }]);
  });

  it("succeeds once a person resolves the value explicitly", async () => {
    await plantEveryLegacyValue(client);
    await client.query(`UPDATE "User" SET role = 'teacher' WHERE id = 'u_faculty'`);
    await expect(applyInTransaction(client, sqlOf(TARGET))).rejects.toThrow();

    // The runbook's step: a named decision, not a blanket rule.
    await client.query(`UPDATE "User" SET role = 'FACULTY' WHERE id = 'u_faculty'`);

    await expect(applyInTransaction(client, sqlOf(TARGET))).resolves.toBeUndefined();
    expect(await columnType(client, "User", "role")).toBe("UserRole");
  });

  it("rolls back losslessly and can be re-applied", async () => {
    await plantEveryLegacyValue(client);
    const original = await snapshot(client);
    await applyInTransaction(client, sqlOf(TARGET));

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path
    await client.query(readFileSync(ROLLBACK, "utf8"));

    expect(await snapshot(client)).toEqual(original);
    expect(await columnType(client, "User", "role")).toBe("text");
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM pg_type WHERE typname IN
        ('UserRole','TopicContentType','EnrollmentStatus','QuizType','BadgeType','ThemePreference')`
    );
    expect(rows[0].n).toBe(0);

    await applyInTransaction(client, sqlOf(TARGET));
    expect(await snapshot(client)).toEqual(original);
  });
});

describe("the migrated schema", () => {
  it.each([
    [`INSERT INTO "User" (id, role, "updatedAt") VALUES ('x', 'student', now())`, "lowercase role"],
    [`INSERT INTO "User" (id, role, "updatedAt") VALUES ('x', 'SUPERUSER', now())`, "unknown role"],
    [`UPDATE "UserSettings" SET theme = 'Dark'`, "capitalised theme"],
  ])("refuses %s (%s)", async (sql) => {
    await expect(testPool().query(sql)).rejects.toMatchObject({ code: "22P02" });
  });

  it("refuses an out-of-set Enrollment status even on a real row", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);
    await testDb().enrollment.create({ data: { userId: learner.id, courseId: course.id } });

    await expect(
      testPool().query(`UPDATE "Enrollment" SET status = 'REFUNDED' WHERE "userId" = $1`, [learner.id])
    ).rejects.toMatchObject({ code: "22P02" });
  });

  it("accepts untyped text parameters, so the previous release keeps working while this one deploys", async () => {
    // The pre-#50 client sends these columns as untyped parameters, exactly as
    // pg does here. PostgreSQL casts a valid value to the enum and refuses an
    // invalid one, so the old code works through the deploy window.
    await testPool().query(`INSERT INTO "User" (id, role, "updatedAt") VALUES ($1, $2, now())`, [
      "old_client",
      "FACULTY",
    ]);
    await testPool().query(`UPDATE "User" SET role = $1 WHERE id = $2`, ["ADMIN", "old_client"]);
    const { rows } = await testPool().query(`SELECT role FROM "User" WHERE role = $1`, ["ADMIN"]);
    expect(rows.map((r) => r.role)).toContain("ADMIN");

    await expect(
      testPool().query(`UPDATE "User" SET role = $1 WHERE id = $2`, ["admin", "old_client"])
    ).rejects.toMatchObject({ code: "22P02" });
  });

  it("finds nothing unexpected in the preflight once migrated", async () => {
    await aUserRow({ role: "ADMIN" });

    const unexpected = await profileClosedStates(async (sql) => (await testPool().query(sql)).rows);

    expect(unexpected).toEqual([]);
  });
});

describe("Enrollment transitions under concurrency", () => {
  let learner: { id: string };
  let courseId: string;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    courseId = (await aCourseWithTopic(author.id)).course.id;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("completes an ACTIVE enrollment exactly once when two requests race", async () => {
    await testDb().enrollment.create({ data: { userId: learner.id, courseId } });

    const results = await Promise.all(
      Array.from({ length: 8 }, () => markCourseCompleted(learner.id, courseId))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const row = await testDb().enrollment.findFirstOrThrow({ where: { userId: learner.id } });
    expect(row.status).toBe("COMPLETED");
  });

  it.each(["SUSPENDED", "COMPLETED"] as const)(
    "never completes a %s enrollment",
    async (status) => {
      await testDb().enrollment.create({ data: { userId: learner.id, courseId, status } });

      expect(await markCourseCompleted(learner.id, courseId)).toBe(false);
      const row = await testDb().enrollment.findFirstOrThrow({ where: { userId: learner.id } });
      expect(row.status).toBe(status);
    }
  );
});
