import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Principal } from "@/lib/auth/policy";
import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const {
  authorizeCaseStudyInCourse,
  authorizeComment,
  authorizeCourse,
  authorizeModuleInCourse,
  authorizePost,
  authorizeQuestionInCourse,
  authorizeQuizInCourse,
  requireCapability,
} = await import("@/lib/auth/guards");
const { Denied } = await import("@/lib/auth/errors");

/**
 * The guards exist to make ADR 0001 section 4 structural: the ownership
 * condition goes *inside* the query that loads the resource, so there is no
 * moment at which an unrelated row has been read and might be returned. The
 * assertions below therefore check the emitted `where` clause, not just the
 * return value -- a guard that filtered in JavaScript after an unfiltered read
 * would pass a return-value test and still be wrong.
 */
const faculty: Principal = { userId: "user_owner", role: "FACULTY" };
const student: Principal = { userId: "user_owner", role: "STUDENT" };
const admin: Principal = { userId: "user_admin", role: "ADMIN" };

async function reasonFor(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    throw new Error("expected the guard to deny");
  } catch (error) {
    if (error instanceof Denied) return error.reason;
    throw error;
  }
}

describe("requireCapability", () => {
  it("passes for a role holding the capability", () => {
    expect(() => requireCapability(admin, "analytics:read")).not.toThrow();
    expect(() => requireCapability(faculty, "course:create")).not.toThrow();
  });

  it("denies as forbidden, not as not_found, for the wrong role", () => {
    // The distinction matters: 403 tells the client the request was understood
    // and refused, so it does not bounce the user to a sign-in page.
    expect(() => requireCapability(faculty, "analytics:read")).toThrow(Denied);
    try {
      requireCapability(student, "course:create");
    } catch (error) {
      expect((error as InstanceType<typeof Denied>).reason).toBe("forbidden");
    }
  });
});

describe("authorizeCourse", () => {
  beforeEach(() => {
    dbMock.course.findFirst.mockResolvedValue({ id: "course_1", userId: "user_owner" });
  });

  it("returns the Course when the principal owns it", async () => {
    await expect(authorizeCourse(faculty, "course:update", "course_1")).resolves.toMatchObject({
      id: "course_1",
    });
  });

  it("asserts ownership inside the query rather than after it", async () => {
    await authorizeCourse(faculty, "course:update", "course_1");

    expect(dbMock.course.findFirst).toHaveBeenCalledWith({
      where: { id: "course_1", userId: "user_owner" },
    });
  });

  it("refuses the wrong role before touching the database", async () => {
    expect(await reasonFor(authorizeCourse(student, "course:update", "course_1"))).toBe("forbidden");
    expect(dbMock.course.findFirst).not.toHaveBeenCalled();
  });

  it("reports a Course owned by someone else as not_found", async () => {
    // The ownership filter means the row simply does not come back. Answering
    // 403 here would confirm the Course exists and turn the endpoint into an
    // oracle for enumerating other people's Courses.
    dbMock.course.findFirst.mockResolvedValue(null);

    expect(await reasonFor(authorizeCourse(faculty, "course:update", "course_1"))).toBe("not_found");
  });

  it("reports a Course that does not exist the same way", async () => {
    dbMock.course.findFirst.mockResolvedValue(null);

    expect(await reasonFor(authorizeCourse(faculty, "course:delete", "missing"))).toBe("not_found");
  });

  it("does not exempt an ADMIN from ownership", async () => {
    dbMock.course.findFirst.mockResolvedValue(null);

    expect(await reasonFor(authorizeCourse(admin, "course:delete", "course_1"))).toBe("not_found");
    expect(dbMock.course.findFirst).toHaveBeenCalledWith({
      where: { id: "course_1", userId: "user_admin" },
    });
  });
});

describe("authorizeModuleInCourse", () => {
  beforeEach(() => {
    dbMock.module.findFirst.mockResolvedValue({ id: "module_1", courseId: "course_1" });
  });

  it("asserts the full Course to Module relationship and both ownership paths", async () => {
    await authorizeModuleInCourse(faculty, "topic:update", "course_1", "module_1");

    // Binding `courseId` in the same query is what stops a Module id belonging
    // to a different Course from being smuggled through the route parameter.
    expect(dbMock.module.findFirst).toHaveBeenCalledWith({
      where: {
        id: "module_1",
        courseId: "course_1",
        OR: [{ course: { userId: "user_owner" } }, { facultyId: "user_owner" }],
      },
    });
  });

  it("refuses the wrong role before touching the database", async () => {
    expect(
      await reasonFor(authorizeModuleInCourse(student, "topic:update", "course_1", "module_1"))
    ).toBe("forbidden");
    expect(dbMock.module.findFirst).not.toHaveBeenCalled();
  });

  it("reports a Module in another Course as not_found", async () => {
    dbMock.module.findFirst.mockResolvedValue(null);

    expect(
      await reasonFor(authorizeModuleInCourse(faculty, "topic:update", "course_1", "module_9"))
    ).toBe("not_found");
  });
});

describe("authorizeQuizInCourse", () => {
  beforeEach(() => {
    dbMock.course.findFirst.mockResolvedValue({ id: "course_1", userId: "user_owner" });
    dbMock.quiz.findFirst.mockResolvedValue({ id: "quiz_1", courseId: "course_1" });
  });

  it("binds the Quiz to the Course in the query", async () => {
    await authorizeQuizInCourse(faculty, "quiz:update", "course_1", "quiz_1");

    expect(dbMock.quiz.findFirst).toHaveBeenCalledWith({
      where: { id: "quiz_1", courseId: "course_1" },
    });
  });

  it("refuses a Quiz belonging to another Course as not_found", async () => {
    dbMock.quiz.findFirst.mockResolvedValue(null);

    expect(
      await reasonFor(authorizeQuizInCourse(faculty, "quiz:update", "course_1", "quiz_9"))
    ).toBe("not_found");
  });

  it("checks Course ownership before looking at the Quiz at all", async () => {
    dbMock.course.findFirst.mockResolvedValue(null);

    expect(
      await reasonFor(authorizeQuizInCourse(faculty, "quiz:update", "course_9", "quiz_1"))
    ).toBe("not_found");
    expect(dbMock.quiz.findFirst).not.toHaveBeenCalled();
  });
});

describe("authorizeQuestionInCourse", () => {
  beforeEach(() => {
    dbMock.course.findFirst.mockResolvedValue({ id: "course_1", userId: "user_owner" });
    dbMock.question.findFirst.mockResolvedValue({ id: "question_1", quizId: "quiz_1" });
  });

  it("asserts every link of Course to Quiz to Question in one query", async () => {
    await authorizeQuestionInCourse(
      faculty,
      "question:update",
      "course_1",
      "quiz_1",
      "question_1"
    );

    // The authoring routes previously wrote with `where: { id: questionId }`
    // alone, so any Question in the product could be edited by id.
    expect(dbMock.question.findFirst).toHaveBeenCalledWith({
      where: { id: "question_1", quizId: "quiz_1", quiz: { courseId: "course_1" } },
    });
  });

  it("refuses a Question from another Quiz", async () => {
    dbMock.question.findFirst.mockResolvedValue(null);

    expect(
      await reasonFor(
        authorizeQuestionInCourse(faculty, "question:delete", "course_1", "quiz_1", "question_9")
      )
    ).toBe("not_found");
  });

  it("refuses a learner before touching the database", async () => {
    expect(
      await reasonFor(
        authorizeQuestionInCourse(student, "question:delete", "course_1", "quiz_1", "question_1")
      )
    ).toBe("forbidden");
    expect(dbMock.question.findFirst).not.toHaveBeenCalled();
  });
});

describe("authorizeCaseStudyInCourse", () => {
  beforeEach(() => {
    dbMock.course.findFirst.mockResolvedValue({ id: "course_1", userId: "user_owner" });
    dbMock.caseStudy.findFirst.mockResolvedValue({ id: "case_1", topicId: "topic_1" });
  });

  it("asserts Course to Module to Topic to Case Study in one query", async () => {
    await authorizeCaseStudyInCourse(faculty, "caseStudy:update", "course_1", "case_1");

    expect(dbMock.caseStudy.findFirst).toHaveBeenCalledWith({
      where: { id: "case_1", topic: { module: { courseId: "course_1" } } },
    });
  });

  it("refuses a Case Study belonging to another Course", async () => {
    dbMock.caseStudy.findFirst.mockResolvedValue(null);

    expect(
      await reasonFor(authorizeCaseStudyInCourse(faculty, "caseStudy:delete", "course_1", "case_9"))
    ).toBe("not_found");
  });

  it("refuses a learner before touching the database", async () => {
    expect(
      await reasonFor(authorizeCaseStudyInCourse(student, "caseStudy:update", "course_1", "case_1"))
    ).toBe("forbidden");
    expect(dbMock.caseStudy.findFirst).not.toHaveBeenCalled();
  });

  it("does not exempt an ADMIN who does not own the Course", async () => {
    // Case studies previously gated on isAdmin with no ownership check at all,
    // so any administrator could edit any Course's case studies.
    dbMock.course.findFirst.mockResolvedValue(null);

    expect(
      await reasonFor(authorizeCaseStudyInCourse(admin, "caseStudy:update", "course_1", "case_1"))
    ).toBe("not_found");
  });
});

describe("authorizePost and authorizeComment", () => {
  it("allows an author to act on their own post", async () => {
    dbMock.forumPost.findUnique.mockResolvedValue({ id: "post_1", userId: "user_owner" });

    await expect(authorizePost(student, "post:update", "post_1")).resolves.toMatchObject({
      id: "post_1",
    });
  });

  it("refuses a non-author who is not a moderator", async () => {
    dbMock.forumPost.findUnique.mockResolvedValue({ id: "post_1", userId: "someone_else" });

    expect(await reasonFor(authorizePost(student, "post:delete", "post_1"))).toBe("forbidden");
  });

  it("allows a moderator to act on anyone's post", async () => {
    dbMock.forumPost.findUnique.mockResolvedValue({ id: "post_1", userId: "someone_else" });

    await expect(authorizePost(admin, "post:delete", "post_1")).resolves.toMatchObject({
      id: "post_1",
    });
  });

  it("reports a missing post as not_found", async () => {
    dbMock.forumPost.findUnique.mockResolvedValue(null);

    expect(await reasonFor(authorizePost(admin, "post:delete", "missing"))).toBe("not_found");
  });

  it("applies the same rules to comments", async () => {
    dbMock.forumComment.findUnique.mockResolvedValue({ id: "c1", userId: "someone_else" });
    expect(await reasonFor(authorizeComment(student, "comment:delete", "c1"))).toBe("forbidden");

    await expect(authorizeComment(admin, "comment:delete", "c1")).resolves.toMatchObject({ id: "c1" });

    dbMock.forumComment.findUnique.mockResolvedValue(null);
    expect(await reasonFor(authorizeComment(admin, "comment:delete", "c1"))).toBe("not_found");
  });
});
