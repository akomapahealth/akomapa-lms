import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const {
  findPublishedTopicInCourse,
  publishedTopicInCourse,
  topicBelongsToCourse,
  topicInCourse,
} = await import("@/lib/courses/topic-access");

/**
 * The Course → Module → Topic relationship (#39).
 *
 * A Topic id in a URL proves nothing about which Course it belongs to. These
 * tests assert the *shape of the query*, not just its result: a check that ran
 * after an unfiltered read would satisfy a return-value test and still leave
 * the row exposed to any call site that forgot to run it.
 */
describe("publishedTopicInCourse", () => {
  it("binds the Topic to the Course through its Module", () => {
    expect(publishedTopicInCourse("course_1", "topic_1")).toEqual({
      id: "topic_1",
      isPublished: true,
      module: { courseId: "course_1", isPublished: true },
    });
  });

  it("requires the Module to be published, not only the Topic", () => {
    // Withdrawing a Module from learners has to actually withdraw its Topics.
    // Filtering on the Topic alone would leave them reachable by direct URL.
    const where = publishedTopicInCourse("course_1", "topic_1");

    expect(where.isPublished).toBe(true);
    expect(where.module.isPublished).toBe(true);
  });

  it("never omits the Course binding", () => {
    const where = publishedTopicInCourse("course_1", "topic_1");

    expect(where.module.courseId).toBe("course_1");
  });
});

describe("topicInCourse", () => {
  it("keeps the Course binding but not the publication filter", () => {
    // Staff author unpublished content by definition. The Course binding is
    // what must never be dropped.
    expect(topicInCourse("course_1", "topic_1")).toEqual({
      id: "topic_1",
      module: { courseId: "course_1" },
    });
  });
});

describe("findPublishedTopicInCourse", () => {
  beforeEach(() => {
    dbMock.topic.findFirst.mockResolvedValue({
      id: "topic_1",
      moduleId: "module_1",
      module: { id: "module_1", courseId: "course_1" },
    });
  });

  it("queries with the full relationship asserted", async () => {
    await findPublishedTopicInCourse("course_1", "topic_1");

    expect(dbMock.topic.findFirst).toHaveBeenCalledWith({
      where: {
        id: "topic_1",
        isPublished: true,
        module: { courseId: "course_1", isPublished: true },
      },
      include: { module: true },
    });
  });

  it("returns null for a Topic that belongs to another Course", async () => {
    // The filter means the row simply does not come back -- the caller cannot
    // accidentally use it, because it never has it.
    dbMock.topic.findFirst.mockResolvedValue(null);

    await expect(findPublishedTopicInCourse("course_1", "topic_from_course_2"))
      .resolves.toBeNull();
  });

  it("uses findFirst rather than findUnique, so the filter cannot be ignored", async () => {
    // `findUnique` accepts only unique fields, which is what forced the original
    // code to look the Topic up by id alone. The relationship needs findFirst.
    await findPublishedTopicInCourse("course_1", "topic_1");

    expect(dbMock.topic.findUnique).not.toHaveBeenCalled();
    expect(dbMock.topic.findFirst).toHaveBeenCalled();
  });
});

describe("topicBelongsToCourse", () => {
  it("is true when the Topic is in the Course", async () => {
    dbMock.topic.findFirst.mockResolvedValue({ id: "topic_1" });

    await expect(topicBelongsToCourse("course_1", "topic_1")).resolves.toBe(true);
  });

  it("is false when it is not, without leaking the row", async () => {
    dbMock.topic.findFirst.mockResolvedValue(null);

    await expect(topicBelongsToCourse("course_1", "topic_9")).resolves.toBe(false);
    expect(dbMock.topic.findFirst).toHaveBeenCalledWith({
      where: { id: "topic_9", module: { courseId: "course_1" } },
      select: { id: true },
    });
  });

  it("does not filter on publication, so staff mutations still resolve", async () => {
    dbMock.topic.findFirst.mockResolvedValue({ id: "topic_1" });

    await topicBelongsToCourse("course_1", "topic_1");

    const where = dbMock.topic.findFirst.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("isPublished");
  });
});
