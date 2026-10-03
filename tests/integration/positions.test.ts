import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS, TEST_ORIGIN } from "../support/origin";

import { testDb } from "./support/db";
import { aCourseWithTopic, aQuizWithQuestion, aUserRow } from "./support/fixtures";
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

const { POST: createTopic } = await import("@/app/api/courses/[courseId]/chapters/route");
const { PUT: reorderTopics } = await import("@/app/api/courses/[courseId]/chapters/reorder/route");
const { POST: createQuestion } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/questions/route"
);
const { PUT: reorderQuestions } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/questions/reorder/route"
);
const { PATCH: patchQuestion } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/questions/[questionId]/route"
);

/**
 * Positions are unique per parent (#51), against real PostgreSQL.
 */

function json(method: string, body: unknown) {
  return new Request(`${TEST_ORIGIN}/api`, {
    method,
    headers: { ...SAME_ORIGIN_HEADERS, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("the migration on a database that already holds duplicates", () => {
  const TARGET = "20261003030000_unique_positions";
  let upgrade: UpgradeDatabase;

  beforeEach(async () => {
    upgrade = await atMigration(TARGET, "positions");
    await upgrade.client.query(`
      INSERT INTO "User" (id, "updatedAt") VALUES ('u1', now());
      INSERT INTO "Course" (id, "userId", title, "updatedAt") VALUES ('c1', 'u1', 'C', now()), ('c2', 'u1', 'D', now());
      INSERT INTO "Module" (id, "courseId", title, position, "createdAt", "updatedAt") VALUES
        ('m_a', 'c1', 'A', 0, '2026-01-01', now()),
        ('m_b', 'c1', 'B', 0, '2026-01-02', now()),
        ('m_c', 'c1', 'C', 1, '2026-01-03', now()),
        ('m_gap1', 'c2', 'G1', 1, now(), now()),
        ('m_gap2', 'c2', 'G2', 5, now(), now());
      INSERT INTO "Chapter" (id, "moduleId", title, position, "createdAt", "updatedAt") VALUES
        ('t_first', 'm_a', 'T1', 3, '2026-01-01', now()),
        ('t_second', 'm_a', 'T2', 3, '2026-01-02', now()),
        ('t_third', 'm_a', 'T3', 3, '2026-01-03', now());
    `);
  }, 60_000);

  afterEach(async () => {
    await upgrade.drop();
  });

  async function positions(table: string, ids: string[]) {
    const { rows } = await upgrade.client.query(
      `SELECT id, position FROM "${table}" WHERE id = ANY($1) ORDER BY position, id`,
      [ids]
    );
    return rows.map((r) => `${r.id}:${r.position}`);
  }

  it("renumbers only duplicated parents, keeping their order and starting point", async () => {
    await upgrade.applyMigration(TARGET);

    // Course c1 had A and B at 0 (A older), then C at 1.
    expect(await positions("Module", ["m_a", "m_b", "m_c"])).toEqual(["m_a:0", "m_b:1", "m_c:2"]);
    // Three Topics at 3, ordered by createdAt, renumbered from 3.
    expect(await positions("Chapter", ["t_first", "t_second", "t_third"])).toEqual([
      "t_first:3",
      "t_second:4",
      "t_third:5",
    ]);
    // A parent without duplicates keeps its gaps.
    expect(await positions("Module", ["m_gap1", "m_gap2"])).toEqual(["m_gap1:1", "m_gap2:5"]);
  });

  it("enforces uniqueness afterwards", async () => {
    await upgrade.applyMigration(TARGET);

    await expect(
      upgrade.client.query(`UPDATE "Module" SET position = 0 WHERE id = 'm_b'`)
    ).rejects.toMatchObject({ code: "23505" });
  });
});

describe("routes keep positions unique", () => {
  let author: { id: string };
  let world: Awaited<ReturnType<typeof aCourseWithTopic>>;

  beforeEach(async () => {
    author = await aUserRow({ role: "FACULTY" });
    world = await aCourseWithTopic(author.id);
    clerkAuth.mockResolvedValue({ userId: author.id });
  });

  async function topicAt(position: number) {
    return testDb().topic.create({
      data: { moduleId: world.module.id, title: `T${position}`, position },
    });
  }

  it("swaps two Topics through temporary positions", async () => {
    const second = await topicAt(2);

    const response = await reorderTopics(
      json("PUT", {
        list: [
          { id: world.topic.id, position: 2 },
          { id: second.id, position: 1 },
        ],
      }),
      { params: Promise.resolve({ courseId: world.course.id }) }
    );

    expect(response.status).toBe(204);
    const after = await testDb().topic.findMany({
      where: { moduleId: world.module.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    expect(after).toEqual([
      { id: second.id, position: 1 },
      { id: world.topic.id, position: 2 },
    ]);
  });

  it("refuses a reorder that collides with an unlisted sibling, and rolls it all back", async () => {
    const second = await topicAt(2);

    const response = await reorderTopics(
      json("PUT", { list: [{ id: world.topic.id, position: 2 }] }),
      { params: Promise.resolve({ courseId: world.course.id }) }
    );

    expect(response.status).toBe(409);
    const unchanged = await testDb().topic.findMany({
      where: { moduleId: world.module.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    expect(unchanged).toEqual([
      { id: world.topic.id, position: 1 },
      { id: second.id, position: 2 },
    ]);
  });

  it("gives concurrent Topic creates distinct positions", async () => {
    const responses = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        createTopic(json("POST", { title: `Concurrent ${i}` }), {
          params: Promise.resolve({ courseId: world.course.id }),
        })
      )
    );

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    const general = await testDb().module.findMany({
      where: { courseId: world.course.id, title: "General" },
    });
    // One default Module, even when the first creates race for it.
    expect(general).toHaveLength(1);
    const created = await testDb().topic.findMany({ where: { moduleId: general[0].id } });
    expect(new Set(created.map((t) => t.position)).size).toBe(3);
  });

  it("gives the default Module a free position rather than 0", async () => {
    await createTopic(json("POST", { title: "First" }), {
      params: Promise.resolve({ courseId: world.course.id }),
    });

    const modules = await testDb().module.findMany({
      where: { courseId: world.course.id },
      orderBy: { position: "asc" },
    });
    expect(new Set(modules.map((m) => m.position)).size).toBe(modules.length);
  });

  describe("Questions and options", () => {
    let quizWorld: Awaited<ReturnType<typeof aQuizWithQuestion>>;

    beforeEach(async () => {
      quizWorld = await aQuizWithQuestion(world.course.id);
    });

    const ids = () => ({ courseId: world.course.id, quizId: quizWorld.quiz.id });

    it("gives concurrent Question creates distinct positions", async () => {
      const responses = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          createQuestion(json("POST", { text: `Q${i}` }), { params: Promise.resolve(ids()) })
        )
      );

      expect(responses.every((r) => r.status === 200)).toBe(true);
      const questions = await testDb().question.findMany({ where: { quizId: quizWorld.quiz.id } });
      expect(new Set(questions.map((q) => q.position)).size).toBe(questions.length);
    });

    it("swaps two Questions", async () => {
      const second = await testDb().question.create({
        data: { quizId: quizWorld.quiz.id, text: "Second", position: 2 },
      });

      const response = await reorderQuestions(
        json("PUT", {
          list: [
            { id: quizWorld.question.id, position: 2 },
            { id: second.id, position: 1 },
          ],
        }),
        { params: Promise.resolve(ids()) }
      );

      expect(response.status).toBe(204);
    });

    it("swaps two options' positions in one edit", async () => {
      const response = await patchQuestion(
        json("PATCH", {
          options: [
            { id: quizWorld.correct.id, text: "Right", isCorrect: true, position: 2 },
            { id: quizWorld.wrong.id, text: "Wrong", isCorrect: false, position: 1 },
          ],
        }),
        { params: Promise.resolve({ ...ids(), questionId: quizWorld.question.id }) }
      );

      expect(response.status).toBe(200);
      const options = await testDb().questionOption.findMany({
        where: { questionId: quizWorld.question.id },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      expect(options.map((o) => o.id)).toEqual([quizWorld.wrong.id, quizWorld.correct.id]);
    });
  });
});
