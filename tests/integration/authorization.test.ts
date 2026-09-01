import { beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import { aCourseWithTopic, aPurchaseRow, aUserRow } from "./support/fixtures";

// The guards import `@/lib/db`. Point that at the disposable database, lazily,
// so the module graph does not need the real connection string at import time.
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const { authorizeCourse, authorizeTopicInCourse } = await import("@/lib/auth/guards");
const { Denied } = await import("@/lib/auth/errors");
const { findPublishedTopicInCourse } = await import("@/lib/courses/topic-access");
const { getTopic } = await import("@/actions/get-topic");

/**
 * The Wave 1 authorization fixes, against real rows.
 *
 * The unit suite asserts the *shape* of each query. These assert what
 * PostgreSQL actually returns for it — which is the only way to know that a
 * relation name is right, that a nested filter traverses the relation the way
 * it reads, and that the row genuinely does not come back.
 */
async function reasonFor(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    throw new Error("expected the guard to deny");
  } catch (error) {
    if (error instanceof Denied) return error.reason;
    throw error;
  }
}

describe("cross-course Topic access (#39)", () => {
  let learner: { id: string };
  let owned: Awaited<ReturnType<typeof aCourseWithTopic>>;
  let foreign: Awaited<ReturnType<typeof aCourseWithTopic>>;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });

    owned = await aCourseWithTopic(author.id);
    foreign = await aCourseWithTopic(author.id);

    // The learner legitimately owns the first Course and nothing else.
    await aPurchaseRow(learner.id, owned.course.id);
  });

  it("finds a Topic through its own Course", async () => {
    const found = await findPublishedTopicInCourse(owned.course.id, owned.topic.id);

    expect(found?.id).toBe(owned.topic.id);
  });

  it("does not find a Topic through a different Course", async () => {
    // Both rows exist. Only the relationship differs, which is exactly what a
    // mock cannot verify.
    const found = await findPublishedTopicInCourse(owned.course.id, foreign.topic.id);

    expect(found).toBeNull();
  });

  it("returns no content for a foreign Topic even to a paying learner", async () => {
    const result = await getTopic({
      userId: learner.id,
      courseId: owned.course.id,
      topicId: foreign.topic.id,
    });

    expect(result.topic).toBeNull();
    expect(result.muxData).toBeNull();
    expect(result.attachments).toEqual([]);
  });

  it("still serves the Topic the learner actually bought", async () => {
    const result = await getTopic({
      userId: learner.id,
      courseId: owned.course.id,
      topicId: owned.topic.id,
    });

    expect(result.topic?.id).toBe(owned.topic.id);
    expect(result.purchase).not.toBeNull();
  });

  it("hides a Topic whose Module is unpublished, even inside the right Course", async () => {
    await testDb().module.update({
      where: { id: owned.module.id },
      data: { isPublished: false },
    });

    const found = await findPublishedTopicInCourse(owned.course.id, owned.topic.id);

    expect(found).toBeNull();
  });
});

describe("authoring ownership (#42, #39)", () => {
  it("lets an author reach their own Course and Topic", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const { course, topic } = await aCourseWithTopic(author.id);
    const principal = { userId: author.id, role: "FACULTY" as const };

    await expect(authorizeCourse(principal, "course:update", course.id)).resolves.toMatchObject({
      id: course.id,
    });
    await expect(
      authorizeTopicInCourse(principal, "topic:update", course.id, topic.id)
    ).resolves.toMatchObject({ id: topic.id });
  });

  it("denies an author another author's Course", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const stranger = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    expect(
      await reasonFor(
        authorizeCourse({ userId: stranger.id, role: "FACULTY" }, "course:delete", course.id)
      )
    ).toBe("not_found");
  });

  it("denies a Topic from another Course even to that Course's owner", async () => {
    const author = await aUserRow({ role: "FACULTY" });
    const owned = await aCourseWithTopic(author.id);
    const other = await aCourseWithTopic(author.id);

    // Same author owns both, so this is purely the Course→Module→Topic binding.
    expect(
      await reasonFor(
        authorizeTopicInCourse(
          { userId: author.id, role: "FACULTY" },
          "topic:delete",
          owned.course.id,
          other.topic.id
        )
      )
    ).toBe("not_found");
  });

  it("denies a learner before any row is read", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const { course } = await aCourseWithTopic(author.id);

    expect(
      await reasonFor(
        authorizeCourse({ userId: learner.id, role: "STUDENT" }, "course:update", course.id)
      )
    ).toBe("forbidden");
  });
});
