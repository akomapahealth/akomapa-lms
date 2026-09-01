import { describe, expect, it } from "vitest";

import { testDb } from "./support/db";
import {
  aCourseWithTopic,
  anAttemptRow,
  aPurchaseRow,
  aQuizWithQuestion,
  aUserRow,
} from "./support/fixtures";

/**
 * Transactions, concurrency, and constraints.
 *
 * None of this is observable against a mock: a test double will happily accept
 * two conflicting writes, honour no unique constraint, and cascade nothing.
 */
describe("quiz submission is claimed exactly once (#41)", () => {
  it("lets only one of two concurrent finalisations win", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);
    const { quiz } = await aQuizWithQuestion(course.id);
    const attempt = await anAttemptRow(learner.id, quiz.id);

    // The route's finalisation: a conditional update on completedAt still being
    // null. Both callers pass the earlier `if (attempt.completedAt)` check, so
    // this is the only thing standing between a double-click and two gradings.
    const claim = () =>
      testDb().quizAttempt.updateMany({
        where: { id: attempt.id, completedAt: null },
        data: { score: 10, totalPoints: 10, completedAt: new Date() },
      });

    const [first, second] = await Promise.all([claim(), claim()]);

    expect(first.count + second.count).toBe(1);
  });

  it("leaves the attempt finalised exactly once", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);
    const { quiz } = await aQuizWithQuestion(course.id);
    const attempt = await anAttemptRow(learner.id, quiz.id);

    await testDb().quizAttempt.updateMany({
      where: { id: attempt.id, completedAt: null },
      data: { score: 10, totalPoints: 10, completedAt: new Date() },
    });
    const second = await testDb().quizAttempt.updateMany({
      where: { id: attempt.id, completedAt: null },
      data: { score: 0, totalPoints: 10, completedAt: new Date() },
    });

    expect(second.count).toBe(0);

    // The second submission must not have overwritten the first score.
    const finalised = await testDb().quizAttempt.findUnique({ where: { id: attempt.id } });
    expect(finalised?.score).toBe(10);
  });
});

describe("transaction rollback", () => {
  it("discards every write when the transaction throws", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    await expect(
      testDb().$transaction(async (tx) => {
        await tx.purchase.create({ data: { userId: learner.id, courseId: course.id } });
        await tx.enrollment.create({ data: { userId: learner.id, courseId: course.id } });
        throw new Error("something failed after the writes");
      })
    ).rejects.toThrow("something failed after the writes");

    // Neither row survives. A mock would have kept both.
    expect(await testDb().purchase.count()).toBe(0);
    expect(await testDb().enrollment.count()).toBe(0);
  });

  it("commits every write when it does not", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    await testDb().$transaction(async (tx) => {
      await tx.purchase.create({ data: { userId: learner.id, courseId: course.id } });
      await tx.enrollment.create({ data: { userId: learner.id, courseId: course.id } });
    });

    expect(await testDb().purchase.count()).toBe(1);
    expect(await testDb().enrollment.count()).toBe(1);
  });
});

describe("constraints the application relies on", () => {
  it("refuses a second Purchase of the same Course by the same learner", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    await aPurchaseRow(learner.id, course.id);

    // Stripe can deliver a webhook twice; the unique constraint is what makes
    // reconciliation idempotent rather than the handler remembering to check.
    await expect(aPurchaseRow(learner.id, course.id)).rejects.toThrow();
    expect(await testDb().purchase.count()).toBe(1);
  });

  it("refuses a second Enrollment for the same learner and Course", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    await testDb().enrollment.create({ data: { userId: learner.id, courseId: course.id } });

    await expect(
      testDb().enrollment.create({ data: { userId: learner.id, courseId: course.id } })
    ).rejects.toThrow();
  });

  it("refuses progress against a Topic that does not exist", async () => {
    const learner = await aUserRow();

    await expect(
      testDb().userProgress.create({
        data: { userId: learner.id, topicId: "topic_that_never_existed", isCompleted: true },
      })
    ).rejects.toThrow();
  });

  it("removes a Course's Modules and Topics with it", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    await testDb().course.delete({ where: { id: course.id } });

    expect(await testDb().module.count()).toBe(0);
    expect(await testDb().topic.count()).toBe(0);
  });
});
