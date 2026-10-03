import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS, TEST_ORIGIN } from "../support/origin";

import { testDb, testPool } from "./support/db";
import { aCourseWithTopic, anAttemptRow, aPaidEnrollment, aQuizWithQuestion, aUserRow } from "./support/fixtures";
import { atMigration, type UpgradeDatabase } from "./support/upgrade";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth, currentUser: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(undefined) }));

const { POST: createQuiz } = await import("@/app/api/courses/[courseId]/quizzes/route");
const { PATCH: patchQuiz } = await import("@/app/api/courses/[courseId]/quizzes/[quizId]/route");
const { profileIntegrity } = await import("@/lib/db/integrity");

/**
 * Integrity constraints from migration 20261003050000, against real
 * PostgreSQL (#51).
 */

let author: { id: string };
let learner: { id: string };
let world: Awaited<ReturnType<typeof aCourseWithTopic>>;

beforeEach(async () => {
  author = await aUserRow({ role: "FACULTY" });
  learner = await aUserRow();
  world = await aCourseWithTopic(author.id);
  clerkAuth.mockResolvedValue({ userId: author.id });
});

describe("range constraints", () => {
  it.each([
    ["a negative price", `UPDATE "Course" SET price = -1`, "Course_price_non_negative"],
    ["a passing score above 100", `UPDATE "Quiz" SET "passingScore" = 101`, "Quiz_passingScore_percentage"],
    ["a negative passing score", `UPDATE "Quiz" SET "passingScore" = -5`, "Quiz_passingScore_percentage"],
    ["a zero time limit", `UPDATE "Quiz" SET "timeLimitMinutes" = 0`, "Quiz_timeLimitMinutes_positive"],
    ["negative points", `UPDATE "Question" SET points = -1`, "Question_points_non_negative"],
    ["a score above the total", `UPDATE "QuizAttempt" SET score = 11, "totalPoints" = 10`, "QuizAttempt_score_within_total"],
    ["a negative score", `UPDATE "QuizAttempt" SET score = -1, "totalPoints" = 10`, "QuizAttempt_score_within_total"],
    ["a negative position", `UPDATE "Chapter" SET position = -1`, "Chapter_position_non_negative"],
  ])("refuses %s", async (_label, sql, constraint) => {
    const { quiz } = await aQuizWithQuestion(world.course.id);
    await anAttemptRow(learner.id, quiz.id);

    await expect(testPool().query(sql)).rejects.toMatchObject({ code: "23514", constraint });
  });

  it("refuses a longest streak shorter than the current one", async () => {
    await expect(
      testPool().query(
        `INSERT INTO "LearningStreak" (id, "userId", "currentStreak", "longestStreak", "updatedAt") VALUES ('s', $1, 5, 3, now())`,
        [learner.id]
      )
    ).rejects.toMatchObject({ code: "23514", constraint: "LearningStreak_counts_consistent" });
  });

  it("accepts the edges of every range", async () => {
    const { quiz } = await aQuizWithQuestion(world.course.id);
    const attempt = await anAttemptRow(learner.id, quiz.id);

    await testPool().query(`UPDATE "Course" SET price = 0 WHERE id = $1`, [world.course.id]);
    await testPool().query(`UPDATE "Quiz" SET "passingScore" = 100, "timeLimitMinutes" = 1 WHERE id = $1`, [quiz.id]);
    await testPool().query(`UPDATE "Question" SET points = 0 WHERE "quizId" = $1`, [quiz.id]);
    await testPool().query(`UPDATE "QuizAttempt" SET score = 10, "totalPoints" = 10 WHERE id = $1`, [attempt.id]);
    await testPool().query(`UPDATE "QuizAttempt" SET score = NULL, "totalPoints" = NULL WHERE id = $1`, [attempt.id]);
  });
});

describe("immutable identifiers", () => {
  it.each([
    ["a Certificate's number", async () => {
      const cert = await testDb().certificate.create({
        data: { userId: learner.id, courseId: world.course.id, certificateNumber: "GHELP-2026-00001" },
      });
      return () => testDb().certificate.update({ where: { id: cert.id }, data: { certificateNumber: "GHELP-2026-99999" } });
    }],
    ["a Certificate's learner", async () => {
      const cert = await testDb().certificate.create({
        data: { userId: learner.id, courseId: world.course.id, certificateNumber: "GHELP-2026-00002" },
      });
      return () => testDb().certificate.update({ where: { id: cert.id }, data: { userId: author.id } });
    }],
    ["an Enrollment's Course", async () => {
      await aPaidEnrollment(learner.id, world.course.id);
      const other = await aCourseWithTopic(author.id);
      return () => testDb().enrollment.updateMany({ where: { userId: learner.id }, data: { courseId: other.course.id } });
    }],
    ["a Purchase's learner", async () => {
      await aPaidEnrollment(learner.id, world.course.id);
      return () => testDb().purchase.updateMany({ where: { userId: learner.id }, data: { userId: author.id } });
    }],
    ["an attempt's Quiz", async () => {
      const { quiz } = await aQuizWithQuestion(world.course.id);
      const other = await aQuizWithQuestion(world.course.id);
      const attempt = await anAttemptRow(learner.id, quiz.id);
      return () => testDb().quizAttempt.update({ where: { id: attempt.id }, data: { quizId: other.quiz.id } });
    }],
    ["progress's Topic", async () => {
      const row = await testDb().userProgress.create({ data: { userId: learner.id, topicId: world.topic.id } });
      const other = await aCourseWithTopic(author.id);
      return () => testDb().userProgress.update({ where: { id: row.id }, data: { topicId: other.topic.id } });
    }],
  ])("refuses to change %s", async (_label, plant) => {
    const change = await plant();

    await expect(change()).rejects.toThrow(/immutable_identifier/);
  });

  it("still allows every other column to change", async () => {
    await aPaidEnrollment(learner.id, world.course.id);
    const cert = await testDb().certificate.create({
      data: { userId: learner.id, courseId: world.course.id, certificateNumber: "GHELP-2026-00003" },
    });

    await testDb().enrollment.updateMany({ where: { userId: learner.id }, data: { status: "COMPLETED" } });
    await testDb().certificate.update({ where: { id: cert.id }, data: { pdfUrl: "data:application/pdf;base64,AA==" } });
    // And a no-op upsert, which is how recordPaidEnrollment redelivers.
    await testDb().enrollment.upsert({
      where: { userId_courseId: { userId: learner.id, courseId: world.course.id } },
      create: { userId: learner.id, courseId: world.course.id },
      update: {},
    });
  });
});

describe("one Pre-Test and one Post-Test per Course", () => {
  function json(method: string, body: unknown) {
    return new Request(`${TEST_ORIGIN}/api`, {
      method,
      headers: { ...SAME_ORIGIN_HEADERS, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  const params = () => ({ params: Promise.resolve({ courseId: world.course.id }) });

  it("refuses a second Pre-Test at creation, saying why", async () => {
    expect((await createQuiz(json("POST", { title: "Pre", type: "PRE_TEST" }), params())).status).toBe(200);

    const second = await createQuiz(json("POST", { title: "Pre again", type: "PRE_TEST" }), params());

    expect(second.status).toBe(409);
    expect((await second.json()).error.message).toMatch(/already has a Pre-Test/);
    expect(await testDb().quiz.count({ where: { courseId: world.course.id, type: "PRE_TEST" } })).toBe(1);
  });

  it("allows any number of Module quizzes, and one of each growth type", async () => {
    for (const body of [
      { title: "M1", type: "MODULE_QUIZ" },
      { title: "M2", type: "MODULE_QUIZ" },
      { title: "Pre", type: "PRE_TEST" },
      { title: "Post", type: "POST_TEST" },
    ]) {
      expect((await createQuiz(json("POST", body), params())).status).toBe(200);
    }
  });

  it("refuses changing a Module quiz into a second Post-Test, but lets a Post-Test keep its type", async () => {
    await createQuiz(json("POST", { title: "Post", type: "POST_TEST" }), params());
    const post = await testDb().quiz.findFirstOrThrow({ where: { type: "POST_TEST" } });
    const moduleQuiz = (await aQuizWithQuestion(world.course.id)).quiz;

    const into = await patchQuiz(json("PATCH", { type: "POST_TEST" }), {
      params: Promise.resolve({ courseId: world.course.id, quizId: moduleQuiz.id }),
    });
    expect(into.status).toBe(409);

    const keep = await patchQuiz(json("PATCH", { type: "POST_TEST", title: "Renamed" }), {
      params: Promise.resolve({ courseId: world.course.id, quizId: post.id }),
    });
    expect(keep.status).toBe(200);
  });

  it("is enforced by the database when two creates race", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createQuiz(json("POST", { title: `Pre ${i}`, type: "PRE_TEST" }), params()))
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
  });
});

describe("the migration on a database that already violates a rule", () => {
  const TARGET = "20261003050000_integrity_constraints";
  let upgrade: UpgradeDatabase;

  beforeEach(async () => {
    upgrade = await atMigration(TARGET, "integrity");
    await upgrade.client.query(`
      INSERT INTO "User" (id, "updatedAt") VALUES ('u1', now());
      INSERT INTO "Course" (id, "userId", title, price, "updatedAt") VALUES ('c1', 'u1', 'C', -5, now());
      INSERT INTO "Quiz" (id, "courseId", title, type, "passingScore", "updatedAt") VALUES
        ('q_pre1', 'c1', 'A', 'PRE_TEST', 70, now()),
        ('q_pre2', 'c1', 'B', 'PRE_TEST', 150, now());
    `);
  }, 60_000);

  afterEach(async () => {
    await upgrade.drop();
  });

  it("aborts, names every violated rule, and changes nothing", async () => {
    const failure = await upgrade.applyMigration(TARGET).catch((error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("nothing was changed");
    expect(message).toContain("Course_price_non_negative: 1 rows");
    expect(message).toContain("Quiz_passingScore_percentage: 1 rows");
    expect(message).toContain("Quiz_courseId_growth_type_key: 1 rows");

    const { rows } = await upgrade.client.query(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'Course_price_non_negative'`
    );
    expect(rows[0].n).toBe(0);
    const price = await upgrade.client.query(`SELECT price FROM "Course" WHERE id = 'c1'`);
    expect(price.rows[0].price).toBe(-5);
  });

  it("is predicted by the preflight", async () => {
    const findings = await profileIntegrity(async (sql) => (await upgrade.client.query(sql)).rows);

    expect(findings.map((f) => f.rule).sort()).toEqual([
      "Course_price_non_negative",
      "Quiz_courseId_growth_type_key",
      "Quiz_passingScore_percentage",
    ]);
    expect(findings.every((f) => f.effect === "blocks the migration")).toBe(true);
  });

  it("applies once each row is resolved explicitly", async () => {
    await upgrade.client.query(`
      UPDATE "Course" SET price = NULL WHERE id = 'c1';
      UPDATE "Quiz" SET type = 'MODULE_QUIZ', "passingScore" = 70 WHERE id = 'q_pre2';
    `);

    await expect(upgrade.applyMigration(TARGET)).resolves.toBeUndefined();
  });
});
