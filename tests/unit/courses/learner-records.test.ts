import { describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { hasLearnerRecords, LEARNER_RECORDS_CONFLICT } = await import("@/lib/courses/learner-records");

/**
 * The check every delete route makes before touching authored content (#51).
 * The database double answers "nothing exists" by default, so each case plants
 * exactly one record and asserts the scope sees it -- and that an empty scope
 * deletes freely.
 */
const found = { id: "row" };

describe("hasLearnerRecords", () => {
  it.each([
    ["purchase"],
    ["enrollment"],
    ["certificate"],
    ["quizAttempt"],
    ["userProgress"],
    ["caseStudyAttempt"],
  ] as const)("blocks a Course delete when a %s exists", async (model) => {
    dbMock[model].findFirst.mockResolvedValue(found);

    await expect(hasLearnerRecords({ kind: "course", courseId: "c1" })).resolves.toBe(true);
  });

  it("allows a Course delete when nothing references it", async () => {
    await expect(hasLearnerRecords({ kind: "course", courseId: "c1" })).resolves.toBe(false);
  });

  it("finds attempts on module quizzes as well as course quizzes", async () => {
    await hasLearnerRecords({ kind: "course", courseId: "c1" });

    expect(dbMock.quizAttempt.findFirst).toHaveBeenCalledWith({
      where: { quiz: { OR: [{ courseId: "c1" }, { module: { courseId: "c1" } }] } },
      select: { id: true },
    });
  });

  it.each([["userProgress"], ["caseStudyAttempt"]] as const)(
    "blocks a Topic delete when a %s exists",
    async (model) => {
      dbMock[model].findFirst.mockResolvedValue(found);

      await expect(hasLearnerRecords({ kind: "topic", topicId: "t1" })).resolves.toBe(true);
    }
  );

  it("allows an unused Topic delete", async () => {
    await expect(hasLearnerRecords({ kind: "topic", topicId: "t1" })).resolves.toBe(false);
  });

  it.each([
    ["quiz", { kind: "quiz", quizId: "q1" }, "quizAttempt"],
    ["question", { kind: "question", questionId: "qq1" }, "quizAnswer"],
    ["options", { kind: "options", optionIds: ["o1"] }, "quizAnswer"],
    ["caseStudy", { kind: "caseStudy", caseStudyId: "cs1" }, "caseStudyAttempt"],
  ] as const)("blocks a %s delete when learners used it, and allows it otherwise", async (_k, scope, model) => {
    await expect(hasLearnerRecords(scope)).resolves.toBe(false);

    dbMock[model].findFirst.mockResolvedValue(found);
    await expect(hasLearnerRecords(scope)).resolves.toBe(true);
  });

  it("does not query for an empty option list", async () => {
    await expect(hasLearnerRecords({ kind: "options", optionIds: [] })).resolves.toBe(false);
    expect(dbMock.quizAnswer.findFirst).not.toHaveBeenCalled();
  });

  it("fails closed for a scope it does not know", async () => {
    await expect(hasLearnerRecords({ kind: "module" } as never)).resolves.toBe(true);
  });

  it("explains every refusal and what to do instead", () => {
    for (const message of Object.values(LEARNER_RECORDS_CONFLICT)) {
      expect(message.length).toBeGreaterThan(30);
    }
  });
});
