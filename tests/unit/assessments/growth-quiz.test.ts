import { describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { growthQuizConflict } = await import("@/lib/assessments/growth-quiz");

describe("growthQuizConflict (#51)", () => {
  it.each([undefined, "MODULE_QUIZ"] as const)("ignores a %s type without querying", async (type) => {
    await expect(growthQuizConflict("c1", type)).resolves.toBeNull();
    expect(dbMock.quiz.findFirst).not.toHaveBeenCalled();
  });

  it("allows the Course's first Pre-Test", async () => {
    await expect(growthQuizConflict("c1", "PRE_TEST")).resolves.toBeNull();
  });

  it("refuses a second Post-Test and says why", async () => {
    dbMock.quiz.findFirst.mockResolvedValue({ id: "existing" });

    await expect(growthQuizConflict("c1", "POST_TEST")).resolves.toMatch(
      /already has a Post-Test/
    );
  });

  it("lets the Quiz being edited keep its own type", async () => {
    await growthQuizConflict("c1", "PRE_TEST", "q1");

    expect(dbMock.quiz.findFirst).toHaveBeenCalledWith({
      where: { courseId: "c1", type: "PRE_TEST", id: { not: "q1" } },
      select: { id: true },
    });
  });
});
