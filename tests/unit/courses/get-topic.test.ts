import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { getTopic } = await import("@/actions/get-topic");

/**
 * The regression matrix for #39.
 *
 * The defect: `getTopic` loaded the Topic by id alone and then gated content on
 * a purchase of the Course named in the *URL*. Substituting a Topic id from
 * another Course into a purchased Course's URL therefore returned that Topic --
 * and because the purchase check passed, its video and attachments too. Owning
 * one Course unlocked content in every other.
 */
/**
 * A Topic that genuinely exists -- in a *different* Course.
 *
 * The double models both lookups faithfully: `findUnique` by id returns it
 * regardless of Course (which is exactly what the old code asked for and got),
 * while `findFirst` honours the Course binding. So restoring the original query
 * makes these tests fail, which is the only way they are worth having.
 */
const FOREIGN_TOPIC = {
  id: "topic_from_course_2",
  moduleId: "module_2",
  position: 1,
  isFree: false,
  isPublished: true,
  module: { id: "module_2", courseId: "course_2", position: 1 },
};

function foreignTopicExists() {
  dbMock.topic.findUnique.mockResolvedValue(FOREIGN_TOPIC);
  dbMock.topic.findFirst.mockImplementation(
    async (args: { where?: { module?: { courseId?: string } } }) =>
      args?.where?.module?.courseId === FOREIGN_TOPIC.module.courseId
        ? FOREIGN_TOPIC
        : null
  );
}

function courseExists(price: number | null = 0) {
  dbMock.course.findUnique.mockResolvedValue({ price });
}

function topicResolves(overrides: Record<string, unknown> = {}) {
  dbMock.topic.findFirst.mockResolvedValue({
    id: "topic_1",
    moduleId: "module_1",
    position: 1,
    isFree: false,
    isPublished: true,
    module: { id: "module_1", courseId: "course_1", position: 1 },
    ...overrides,
  });
}

beforeEach(() => {
  courseExists();
  dbMock.muxData.findUnique.mockResolvedValue({ id: "mux_1", playbackId: "pb_1" });
  dbMock.attachment.findMany.mockResolvedValue([{ id: "att_1" }]);
});

describe("a Topic from another Course", () => {
  beforeEach(() => {
    foreignTopicExists();
    // The learner legitimately owns the Course named in the URL.
    dbMock.purchase.findUnique.mockResolvedValue({ id: "purchase_1" });
  });

  it("cannot be loaded by substituting its id into a purchased Course URL", async () => {
    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: FOREIGN_TOPIC.id,
    });

    expect(result.topic).toBeNull();
  });

  it("returns no video even though the learner owns the Course in the URL", async () => {
    // The heart of the defect: the purchase was for course_1, the content was
    // from course_2, and the entitlement check never noticed the difference.
    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: FOREIGN_TOPIC.id,
    });

    expect(result.muxData).toBeNull();
    expect(result.attachments).toEqual([]);
  });

  it("returns no navigation derived from the foreign Topic", async () => {
    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: FOREIGN_TOPIC.id,
    });

    expect(result.nextTopic).toBeNull();
    expect(result.previousTopic).toBeNull();
  });

  it("is still reachable from its own Course, so the binding is not simply blocking everything", async () => {
    const result = await getTopic({
      userId: "user_1",
      courseId: "course_2",
      topicId: FOREIGN_TOPIC.id,
    });

    expect(result.topic).not.toBeNull();
  });
});

describe("the query that enforces it", () => {
  it("asks for the Topic through its Module and Course", async () => {
    topicResolves();
    dbMock.purchase.findUnique.mockResolvedValue(null);

    await getTopic({ userId: "user_1", courseId: "course_1", topicId: "topic_1" });

    expect(dbMock.topic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "topic_1",
          isPublished: true,
          module: { courseId: "course_1", isPublished: true },
        },
      })
    );
  });

  it("requires the Course itself to be published", async () => {
    topicResolves();
    dbMock.purchase.findUnique.mockResolvedValue(null);

    await getTopic({ userId: "user_1", courseId: "course_1", topicId: "topic_1" });

    expect(dbMock.course.findUnique).toHaveBeenCalledWith({
      where: { isPublished: true, id: "course_1" },
      select: { price: true },
    });
  });
});

describe("entitlement within the correct Course", () => {
  beforeEach(() => {
    dbMock.topic.findFirst.mockResolvedValue({
      id: "topic_1",
      moduleId: "module_1",
      position: 1,
      isFree: false,
      isPublished: true,
      module: { id: "module_1", courseId: "course_1", position: 1 },
    });
  });

  it("withholds video and attachments from a learner who has not purchased", async () => {
    dbMock.purchase.findUnique.mockResolvedValue(null);

    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: "topic_1",
    });

    expect(result.topic).not.toBeNull();
    expect(result.muxData).toBeNull();
    expect(result.attachments).toEqual([]);
  });

  it("releases video to a purchaser", async () => {
    dbMock.purchase.findUnique.mockResolvedValue({ id: "purchase_1" });

    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: "topic_1",
    });

    expect(result.muxData).not.toBeNull();
    expect(result.attachments).toHaveLength(1);
  });

  it("releases video for a free-preview Topic without a purchase, but not attachments", async () => {
    dbMock.topic.findFirst.mockResolvedValue({
      id: "topic_1",
      moduleId: "module_1",
      position: 1,
      isFree: true,
      isPublished: true,
      module: { id: "module_1", courseId: "course_1", position: 1 },
    });
    dbMock.purchase.findUnique.mockResolvedValue(null);

    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: "topic_1",
    });

    expect(result.muxData).not.toBeNull();
    // Attachments are course materials, not preview content.
    expect(result.attachments).toEqual([]);
  });

  it("scopes the purchase lookup to this learner and this Course", async () => {
    dbMock.purchase.findUnique.mockResolvedValue(null);

    await getTopic({ userId: "user_7", courseId: "course_1", topicId: "topic_1" });

    expect(dbMock.purchase.findUnique).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_7", courseId: "course_1" } },
    });
  });

  it("scopes progress to this learner and this Topic", async () => {
    dbMock.purchase.findUnique.mockResolvedValue(null);

    await getTopic({ userId: "user_7", courseId: "course_1", topicId: "topic_1" });

    expect(dbMock.userProgress.findUnique).toHaveBeenCalledWith({
      where: { userId_topicId: { userId: "user_7", topicId: "topic_1" } },
    });
  });
});

describe("an unpublished or missing Course", () => {
  it("returns nothing when the Course is unpublished", async () => {
    topicResolves();
    dbMock.course.findUnique.mockResolvedValue(null);
    dbMock.purchase.findUnique.mockResolvedValue({ id: "purchase_1" });

    const result = await getTopic({
      userId: "user_1",
      courseId: "course_1",
      topicId: "topic_1",
    });

    expect(result.topic).toBeNull();
    expect(result.course).toBeNull();
  });
});
