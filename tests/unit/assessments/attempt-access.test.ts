import { describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { attemptInQuizAndCourse, findLearnerAttempt } = await import(
  "@/lib/assessments/attempt-access"
);

/**
 * Course → Quiz → Attempt (#41).
 *
 * The submit route checked only that the attempt belonged to the caller, then
 * graded against the questions of the Quiz named in the *route*. Those are
 * different Quizzes whenever the caller says so.
 */
describe("attemptInQuizAndCourse", () => {
  it("binds the attempt to the learner, the Quiz, and the Course at once", () => {
    expect(attemptInQuizAndCourse("user_1", "course_1", "quiz_1", "attempt_1")).toEqual({
      id: "attempt_1",
      userId: "user_1",
      quizId: "quiz_1",
      quiz: { courseId: "course_1" },
    });
  });

  it("never binds by id and owner alone", () => {
    // Ownership without membership is the defect: the attempt was the caller's,
    // but not necessarily on the Quiz being graded.
    const where = attemptInQuizAndCourse("user_1", "course_1", "quiz_1", "attempt_1");

    expect(where.quizId).toBe("quiz_1");
    expect(where.quiz.courseId).toBe("course_1");
  });
});

describe("findLearnerAttempt", () => {
  it("queries with the full relationship asserted", async () => {
    dbMock.quizAttempt.findFirst.mockResolvedValue({ id: "attempt_1", quizId: "quiz_1" });

    await findLearnerAttempt("user_1", "course_1", "quiz_1", "attempt_1");

    expect(dbMock.quizAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "attempt_1",
          userId: "user_1",
          quizId: "quiz_1",
          quiz: { courseId: "course_1" },
        },
      })
    );
  });

  it("returns null for another learner's attempt", async () => {
    dbMock.quizAttempt.findFirst.mockResolvedValue(null);

    await expect(findLearnerAttempt("user_2", "course_1", "quiz_1", "attempt_1"))
      .resolves.toBeNull();
  });

  it("returns null for the learner's own attempt submitted through the wrong Quiz", async () => {
    dbMock.quizAttempt.findFirst.mockResolvedValue(null);

    await expect(findLearnerAttempt("user_1", "course_1", "quiz_OTHER", "attempt_1"))
      .resolves.toBeNull();
  });

  it("uses findFirst, since findUnique cannot express the relationship", async () => {
    dbMock.quizAttempt.findFirst.mockResolvedValue({ id: "attempt_1" });

    await findLearnerAttempt("user_1", "course_1", "quiz_1", "attempt_1");

    expect(dbMock.quizAttempt.findUnique).not.toHaveBeenCalled();
  });
});
