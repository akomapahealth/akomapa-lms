import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS, TEST_ORIGIN } from "../support/origin";

import { testDb } from "./support/db";
import {
  aCaseStudyRow,
  aCourseWithTopic,
  anAttemptRow,
  aPaidEnrollment,
  aQuizWithQuestion,
  aUserRow,
} from "./support/fixtures";

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

// Every Mux delete records whether the row it belonged to still existed at that
// moment, which is how "database first, then Mux" is checked.
const muxDeletes = vi.hoisted(() => [] as { assetId: string; topicStillExists: boolean }[]);
const muxFailure = vi.hoisted(() => ({ next: null as Error | null }));
vi.mock("@mux/mux-node", async () => {
  const { testDb: get } = await import("./support/db");
  class Mux {
    video = {
      assets: {
        create: vi.fn(),
        delete: vi.fn(async (assetId: string) => {
          const row = await get().muxData.findFirst({ where: { assetId } });
          muxDeletes.push({ assetId, topicStillExists: row !== null });
          if (muxFailure.next) {
            const error = muxFailure.next;
            muxFailure.next = null;
            throw error;
          }
        }),
      },
    };
  }
  return { default: Mux, Mux };
});

const { DELETE: deleteCourse } = await import("@/app/api/courses/[courseId]/route");
const { DELETE: deleteTopic } = await import(
  "@/app/api/courses/[courseId]/chapters/[chapterId]/route"
);
const { DELETE: deleteQuiz } = await import("@/app/api/courses/[courseId]/quizzes/[quizId]/route");
const { DELETE: deleteQuestion, PATCH: patchQuestion } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/questions/[questionId]/route"
);
const { DELETE: deleteCaseStudy } = await import(
  "@/app/api/courses/[courseId]/case-studies/[caseStudyId]/route"
);
const { handleRouteError } = await import("@/lib/http");

/**
 * Authored content cannot be deleted out from under learners (#51).
 *
 * Each case runs the real route against PostgreSQL with the RESTRICT
 * constraints from migration 20261003020000. A refusal is checked three ways:
 * the 409 and its reason, the rows that must survive, and Mux untouched.
 */

function del(path: string) {
  return new Request(`${TEST_ORIGIN}${path}`, { method: "DELETE", headers: SAME_ORIGIN_HEADERS });
}

async function bodyOf(response: Response) {
  return response.json() as Promise<{ error: { code: string; message: string } }>;
}

let author: { id: string };
let learner: { id: string };
let world: Awaited<ReturnType<typeof aCourseWithTopic>>;

beforeEach(async () => {
  muxDeletes.length = 0;
  muxFailure.next = null;
  author = await aUserRow({ role: "FACULTY" });
  learner = await aUserRow();
  world = await aCourseWithTopic(author.id);
  await testDb().topic.update({ where: { id: world.topic.id }, data: { videoUrl: "https://v.example/a.mp4" } });
  await testDb().muxData.create({ data: { topicId: world.topic.id, assetId: "asset_1", playbackId: "pb_1" } });
  clerkAuth.mockResolvedValue({ userId: author.id });
});

describe("DELETE a Course", () => {
  const courseDelete = () =>
    deleteCourse(del(`/api/courses/${world.course.id}`), {
      params: Promise.resolve({ courseId: world.course.id }),
    });

  it("refuses when learners are enrolled, keeping payment, enrollment, and video", async () => {
    await aPaidEnrollment(learner.id, world.course.id);

    const response = await courseDelete();

    expect(response.status).toBe(409);
    expect((await bodyOf(response)).error.message).toMatch(/Unpublish it instead/);
    expect(await testDb().course.count({ where: { id: world.course.id } })).toBe(1);
    expect(await testDb().purchase.count()).toBe(1);
    expect(await testDb().enrollment.count()).toBe(1);
    expect(muxDeletes).toEqual([]);
  });

  it.each([
    ["a Certificate", async () => {
      await testDb().certificate.create({ data: { userId: learner.id, courseId: world.course.id, certificateNumber: "GHELP-2026-00001" } });
    }],
    ["Topic progress", async () => {
      await testDb().userProgress.create({ data: { userId: learner.id, topicId: world.topic.id, isCompleted: true } });
    }],
    ["a Quiz attempt", async () => {
      const { quiz } = await aQuizWithQuestion(world.course.id);
      await anAttemptRow(learner.id, quiz.id);
    }],
  ])("refuses when learners hold %s", async (_label, plant) => {
    await plant();

    expect((await courseDelete()).status).toBe(409);
    expect(await testDb().course.count({ where: { id: world.course.id } })).toBe(1);
    expect(muxDeletes).toEqual([]);
  });

  it("deletes a Course nobody has used, then cleans up Mux after the row is gone", async () => {
    const response = await courseDelete();

    expect(response.status).toBe(200);
    expect(await testDb().course.count({ where: { id: world.course.id } })).toBe(0);
    expect(muxDeletes).toEqual([{ assetId: "asset_1", topicStillExists: false }]);
  });

  it("still succeeds, and logs, when Mux cleanup fails afterwards", async () => {
    muxFailure.next = new Error("mux unavailable");

    const response = await courseDelete();

    expect(response.status).toBe(200);
    expect(await testDb().course.count({ where: { id: world.course.id } })).toBe(0);
  });
});

describe("DELETE a Topic", () => {
  const topicDelete = () =>
    deleteTopic(del(`/api/courses/${world.course.id}/chapters/${world.topic.id}`), {
      params: Promise.resolve({ courseId: world.course.id, chapterId: world.topic.id }),
    });

  it("refuses when learners have progress, leaving the video in place", async () => {
    await testDb().userProgress.create({ data: { userId: learner.id, topicId: world.topic.id } });

    const response = await topicDelete();

    expect(response.status).toBe(409);
    expect((await bodyOf(response)).error.message).toMatch(/progress on this topic/);
    expect(await testDb().muxData.count({ where: { assetId: "asset_1" } })).toBe(1);
    expect(muxDeletes).toEqual([]);
  });

  it("refuses when learners attempted its case study", async () => {
    const caseStudy = await aCaseStudyRow(world.topic.id, { steps: [] });
    await testDb().caseStudyAttempt.create({ data: { userId: learner.id, caseStudyId: caseStudy.id, choices: {} } });

    expect((await topicDelete()).status).toBe(409);
  });

  it("deletes an unused Topic, then its Mux asset", async () => {
    expect((await topicDelete()).status).toBe(200);
    expect(await testDb().topic.count({ where: { id: world.topic.id } })).toBe(0);
    expect(muxDeletes).toEqual([{ assetId: "asset_1", topicStillExists: false }]);
  });
});

describe("Quiz, Question, option, and Case Study deletes", () => {
  let quizWorld: Awaited<ReturnType<typeof aQuizWithQuestion>>;

  beforeEach(async () => {
    quizWorld = await aQuizWithQuestion(world.course.id);
  });

  const ids = () => ({ courseId: world.course.id, quizId: quizWorld.quiz.id });

  it("refuses to delete an attempted Quiz and keeps the attempt", async () => {
    await anAttemptRow(learner.id, quizWorld.quiz.id);

    const response = await deleteQuiz(del("/q"), { params: Promise.resolve(ids()) });

    expect(response.status).toBe(409);
    expect(await testDb().quizAttempt.count()).toBe(1);
  });

  it("deletes an unattempted Quiz", async () => {
    const response = await deleteQuiz(del("/q"), { params: Promise.resolve(ids()) });

    expect(response.status).toBe(200);
  });

  it("refuses to delete an answered Question, so no grade changes", async () => {
    const attempt = await anAttemptRow(learner.id, quizWorld.quiz.id);
    await testDb().quizAnswer.create({
      data: { attemptId: attempt.id, questionId: quizWorld.question.id, selectedOptionId: quizWorld.correct.id },
    });

    const response = await deleteQuestion(del("/q"), {
      params: Promise.resolve({ ...ids(), questionId: quizWorld.question.id }),
    });

    expect(response.status).toBe(409);
    expect(await testDb().quizAnswer.count()).toBe(1);
  });

  it("refuses to remove an option a learner chose, and changes nothing else", async () => {
    const attempt = await anAttemptRow(learner.id, quizWorld.quiz.id);
    await testDb().quizAnswer.create({
      data: { attemptId: attempt.id, questionId: quizWorld.question.id, selectedOptionId: quizWorld.wrong.id },
    });

    const response = await patchQuestion(
      new Request(`${TEST_ORIGIN}/q`, {
        method: "PATCH",
        headers: { ...SAME_ORIGIN_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({
          text: "Edited text",
          options: [{ id: quizWorld.correct.id, text: "Right", isCorrect: true, position: 1 }],
        }),
      }),
      { params: Promise.resolve({ ...ids(), questionId: quizWorld.question.id }) }
    );

    expect(response.status).toBe(409);
    expect((await bodyOf(response)).error.message).toMatch(/chosen one of these options/);
    expect(await testDb().questionOption.count({ where: { questionId: quizWorld.question.id } })).toBe(2);
    const question = await testDb().question.findUniqueOrThrow({ where: { id: quizWorld.question.id } });
    expect(question.text).toBe("Which?");
  });

  it("refuses to delete an attempted Case Study", async () => {
    const caseStudy = await aCaseStudyRow(world.topic.id, { steps: [] });
    await testDb().caseStudyAttempt.create({ data: { userId: learner.id, caseStudyId: caseStudy.id, choices: {} } });

    const response = await deleteCaseStudy(del("/c"), {
      params: Promise.resolve({ courseId: world.course.id, caseStudyId: caseStudy.id }),
    });

    expect(response.status).toBe(409);
    expect(await testDb().caseStudy.count()).toBe(1);
  });
});

describe("the database backstop", () => {
  it.each([
    ["a Course with a Purchase", async () => {
      await testDb().purchase.create({ data: { userId: learner.id, courseId: world.course.id } });
      return () => testDb().course.delete({ where: { id: world.course.id } });
    }],
    ["a Course with an Enrollment", async () => {
      await testDb().enrollment.create({ data: { userId: learner.id, courseId: world.course.id } });
      return () => testDb().course.delete({ where: { id: world.course.id } });
    }],
    ["a Topic with progress", async () => {
      await testDb().userProgress.create({ data: { userId: learner.id, topicId: world.topic.id } });
      return () => testDb().topic.delete({ where: { id: world.topic.id } });
    }],
  ])("refuses to delete %s even without the route's check, answered as 409", async (_label, plant) => {
    // What a race between the route's check and its delete would hit.
    const remove = await plant();
    const failure = await remove().catch((error: unknown) => error);

    const response = handleRouteError("TEST", failure);
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).error.code).toBe("conflict");
  });

  it("still deletes authored content beneath a Course nobody used", async () => {
    await testDb().course.delete({ where: { id: world.course.id } });

    expect(await testDb().module.count({ where: { courseId: world.course.id } })).toBe(0);
    expect(await testDb().topic.count({ where: { id: world.topic.id } })).toBe(0);
  });
});
