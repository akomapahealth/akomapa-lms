import { beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import {
  aCourseWithTopic,
  aPaidEnrollment,
  anEnrollmentRow,
  aPurchaseRow,
  aUserRow,
} from "./support/fixtures";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth }));
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const { PUT } = await import(
  "@/app/api/courses/[courseId]/chapters/[chapterId]/progress/route"
);

/**
 * A real route handler, against a real database.
 *
 * Everything the handler touches is genuine except the Clerk session: the
 * principal lookup, the Topic binding, the entitlement check, the progress
 * write, and the completion cascade all run against PostgreSQL. This is the
 * layer where #40's fixes are actually provable.
 */
function request(isCompleted: unknown) {
  return new Request("http://localhost/progress", {
    method: "PUT",
    body: JSON.stringify({ isCompleted }),
    headers: { "content-type": "application/json" },
  });
}

const params = (courseId: string, chapterId: string) =>
  Promise.resolve({ courseId, chapterId });

describe("PUT progress", () => {
  let learner: { id: string };
  let owned: Awaited<ReturnType<typeof aCourseWithTopic>>;
  let foreign: Awaited<ReturnType<typeof aCourseWithTopic>>;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    owned = await aCourseWithTopic(author.id);
    foreign = await aCourseWithTopic(author.id);
    clerkAuth.mockResolvedValue({ userId: learner.id });
  });

  it("records completion for a Topic the learner is enrolled on", async () => {
    await aPaidEnrollment(learner.id, owned.course.id);

    const response = await PUT(request(true), {
      params: params(owned.course.id, owned.topic.id),
    });

    expect(response.status).toBe(200);
    const progress = await testDb().userProgress.findUnique({
      where: { userId_topicId: { userId: learner.id, topicId: owned.topic.id } },
    });
    expect(progress?.isCompleted).toBe(true);
  });

  it("refuses a Topic belonging to a different Course", async () => {
    await aPaidEnrollment(learner.id, owned.course.id);

    const response = await PUT(request(true), {
      params: params(owned.course.id, foreign.topic.id),
    });

    expect(response.status).toBe(404);
    expect(await testDb().userProgress.count()).toBe(0);
  });

  it("refuses a Purchase with no Enrollment", async () => {
    // The ADR 0002 cutover, at the layer where it matters. A Purchase is evidence
    // that a payment happened; it is not entitlement. The backfill migration
    // exists so that no real learner is in this state, and this test is what
    // stops the old behaviour from creeping back.
    await aPurchaseRow(learner.id, owned.course.id);

    const response = await PUT(request(true), {
      params: params(owned.course.id, owned.topic.id),
    });

    expect(response.status).toBe(404);
    expect(await testDb().userProgress.count()).toBe(0);
  });

  it("refuses a suspended learner who has paid", async () => {
    // The case that motivated the ADR: reading Purchase meant a suspension did
    // nothing, so a suspended learner kept completing Topics -- and therefore kept
    // earning badges, streaks, and a Certificate.
    await aPurchaseRow(learner.id, owned.course.id);
    await anEnrollmentRow(learner.id, owned.course.id, "SUSPENDED");

    const response = await PUT(request(true), {
      params: params(owned.course.id, owned.topic.id),
    });

    expect(response.status).toBe(404);
    expect(await testDb().userProgress.count()).toBe(0);
  });

  it("serves a learner whose Enrollment is COMPLETED", async () => {
    // COMPLETED keeps read access to the Course and its Certificate (ADR 0002).
    await aPaidEnrollment(learner.id, owned.course.id, "COMPLETED");

    const response = await PUT(request(true), {
      params: params(owned.course.id, owned.topic.id),
    });

    expect(response.status).toBe(200);
  });

  it("refuses a learner who has not bought the Course", async () => {
    // Before #40 this wrote progress, awarded badges, and could issue a
    // certificate for a Course the learner had never paid for.
    const response = await PUT(request(true), {
      params: params(owned.course.id, owned.topic.id),
    });

    expect(response.status).toBe(404);
    expect(await testDb().userProgress.count()).toBe(0);
  });

  it("allows a free-preview Topic without a purchase", async () => {
    const free = await aCourseWithTopic(learner.id, { topicIsFree: true });

    const response = await PUT(request(true), {
      params: params(free.course.id, free.topic.id),
    });

    expect(response.status).toBe(200);
  });

  it("refuses an unauthenticated request", async () => {
    clerkAuth.mockResolvedValue({ userId: null });
    await aPaidEnrollment(learner.id, owned.course.id);

    const response = await PUT(request(true), {
      params: params(owned.course.id, owned.topic.id),
    });

    expect(response.status).toBe(401);
  });

  it("rejects a non-boolean isCompleted", async () => {
    await aPaidEnrollment(learner.id, owned.course.id);

    for (const value of ["true", 1, {}, null]) {
      const response = await PUT(request(value), {
        params: params(owned.course.id, owned.topic.id),
      });

      // 422, not 400: the body parsed and then failed the schema. #44 reserves
      // 400 for a request that could not be understood at all -- unparseable
      // JSON, or a bad path parameter. See docs/api-errors.md.
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "validation_failed", fields: [{ path: "isCompleted" }] },
      });
    }

    expect(await testDb().userProgress.count()).toBe(0);
  });

  it("issues no certificate for a Course whose only Topic is unpublished", async () => {
    // The vacuous-completion case. The Course has no published Topics, so
    // completing anything must not finish it.
    const empty = await aCourseWithTopic(learner.id, { topicIsFree: true });
    await testDb().topic.update({
      where: { id: empty.topic.id },
      data: { isPublished: false },
    });

    const response = await PUT(request(true), {
      params: params(empty.course.id, empty.topic.id),
    });

    // The Topic is no longer learner-visible, so the write is refused outright.
    expect(response.status).toBe(404);
    expect(await testDb().certificate.count()).toBe(0);
    expect(await testDb().enrollment.count()).toBe(0);
  });

  it("completes the Course and issues one certificate when every Topic is done", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const single = await aCourseWithTopic(author.id, { topicIsFree: true });
    await testDb().enrollment.create({
      data: { userId: learner.id, courseId: single.course.id },
    });

    const response = await PUT(request(true), {
      params: params(single.course.id, single.topic.id),
    });

    expect(response.status).toBe(200);

    const enrollment = await testDb().enrollment.findFirst({
      where: { userId: learner.id, courseId: single.course.id },
    });
    expect(enrollment?.status).toBe("COMPLETED");
    expect(await testDb().certificate.count()).toBe(1);
  });

  it("issues exactly one certificate when completion is replayed", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const single = await aCourseWithTopic(author.id, { topicIsFree: true });
    await testDb().enrollment.create({
      data: { userId: learner.id, courseId: single.course.id },
    });

    await PUT(request(true), { params: params(single.course.id, single.topic.id) });
    await PUT(request(true), { params: params(single.course.id, single.topic.id) });

    // The unique constraint on (userId, courseId) plus the service's own
    // existing-certificate check make re-completion idempotent.
    expect(await testDb().certificate.count()).toBe(1);
  });
});
