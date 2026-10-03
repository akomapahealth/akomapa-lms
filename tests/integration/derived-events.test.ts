import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS, TEST_ORIGIN } from "../support/origin";

import { testDb } from "./support/db";
import { aCourseWithTopic, anAttemptRow, aPaidEnrollment, aQuizWithQuestion, aUserRow } from "./support/fixtures";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth, currentUser: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const failBadges = vi.hoisted(() => ({ next: false }));
vi.mock("@/lib/badge-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/badge-service")>();
  return {
    ...original,
    evaluateBadges: vi.fn(async (...args: Parameters<typeof original.evaluateBadges>) => {
      if (failBadges.next) throw new Error("badge store unavailable");
      return original.evaluateBadges(...args);
    }),
  };
});

const { POST: submitQuiz } = await import("@/app/api/courses/[courseId]/quizzes/[quizId]/submit/route");
const { POST: createPost } = await import("@/app/api/community/posts/route");

/**
 * Quiz submission and Community writes record their badges and events in the
 * same transaction as the write itself (#49, ADR 0004).
 */

function json(body: unknown) {
  return new Request(`${TEST_ORIGIN}/api`, {
    method: "POST",
    headers: { ...SAME_ORIGIN_HEADERS, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function events(type: string) {
  return testDb().outboxEvent.findMany({ where: { type: type as never } });
}

let learner: { id: string };

beforeEach(async () => {
  failBadges.next = false;
  learner = await aUserRow();
  clerkAuth.mockResolvedValue({ userId: learner.id });
});

describe("submitting a Quiz", () => {
  let courseId: string;
  let world: Awaited<ReturnType<typeof aQuizWithQuestion>>;

  beforeEach(async () => {
    const author = await aUserRow({ role: "FACULTY" });
    courseId = (await aCourseWithTopic(author.id)).course.id;
    world = await aQuizWithQuestion(courseId);
    await aPaidEnrollment(learner.id, courseId);
    await testDb().badge.create({
      data: { name: `Perfect ${Math.random()}`, description: "d", type: "QUIZ_SCORE", criteria: { type: "quiz_score", score: 100 } },
    });
  });

  const submit = (attemptId: string) =>
    submitQuiz(
      json({ attemptId, answers: [{ questionId: world.question.id, selectedOptionId: world.correct.id }] }),
      { params: Promise.resolve({ courseId, quizId: world.quiz.id }) }
    );

  it("records the closed attempt and the badge it earns, once", async () => {
    const attempt = await anAttemptRow(learner.id, world.quiz.id);

    const response = await submit(attempt.id);

    expect(response.status).toBe(200);
    expect((await response.json()).awardedBadges).toHaveLength(1);
    expect(await events("QUIZ_ATTEMPT_COMPLETED")).toHaveLength(1);
    expect(await events("BADGE_AWARDED")).toHaveLength(1);
  });

  it("records nothing more on a resubmission", async () => {
    const attempt = await anAttemptRow(learner.id, world.quiz.id);
    await submit(attempt.id);

    expect((await submit(attempt.id)).status).toBe(409);
    expect(await events("QUIZ_ATTEMPT_COMPLETED")).toHaveLength(1);
  });

  it("rolls the whole submission back when awarding fails", async () => {
    const attempt = await anAttemptRow(learner.id, world.quiz.id);
    failBadges.next = true;

    expect((await submit(attempt.id)).status).toBe(500);

    const row = await testDb().quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.completedAt).toBeNull();
    expect(await testDb().quizAnswer.count({ where: { attemptId: attempt.id } })).toBe(0);
    expect(await testDb().outboxEvent.count()).toBe(0);

    // The learner can simply submit again.
    failBadges.next = false;
    expect((await submit(attempt.id)).status).toBe(200);
  });
});

describe("creating a Community post", () => {
  let categoryId: string;

  beforeEach(async () => {
    categoryId = (await testDb().forumCategory.create({ data: { name: `General ${Math.random()}` } })).id;
    await testDb().badge.create({
      data: { name: `Voice ${Math.random()}`, description: "d", type: "COMMUNITY", criteria: { type: "posts_created", count: 1 } },
    });
  });

  const post = () => createPost(json({ title: "Hello", content: "<p>Hi</p>", categoryId }));

  it("awards the badge and records it in the same commit", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect((await response.json()).awardedBadges).toHaveLength(1);
    expect(await events("BADGE_AWARDED")).toHaveLength(1);
  });

  it("does not keep the post when awarding fails", async () => {
    failBadges.next = true;

    expect((await post()).status).toBe(500);
    expect(await testDb().forumPost.count({ where: { userId: learner.id } })).toBe(0);
  });
});
