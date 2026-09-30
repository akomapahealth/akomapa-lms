import { beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import { aCourseWithTopic, aQuizWithQuestion, aUserRow } from "./support/fixtures";

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

const { PUT: reorderTopics } = await import(
  "@/app/api/courses/[courseId]/chapters/reorder/route"
);
const { PUT: reorderQuestions } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/questions/reorder/route"
);
const { PATCH: patchQuestion } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/questions/[questionId]/route"
);

function body(payload: unknown) {
  return new Request("http://localhost/api", {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
}

/**
 * Body ids must belong to the resource the URL authorized (#44).
 *
 * Authorization proves the caller owns the Course or Quiz named in the path. It
 * says nothing about the ids inside the body, and these three routes updated
 * rows matched on `id` alone -- so an author of any Course could reach rows in
 * any other. A real database is needed to show it: the point is which rows moved.
 */
describe("PUT chapters/reorder", () => {
  let author: { id: string };
  let owned: Awaited<ReturnType<typeof aCourseWithTopic>>;
  let foreign: Awaited<ReturnType<typeof aCourseWithTopic>>;

  beforeEach(async () => {
    author = await aUserRow({ role: "FACULTY" });
    const other = await aUserRow({ role: "FACULTY" });
    owned = await aCourseWithTopic(author.id);
    foreign = await aCourseWithTopic(other.id);
    clerkAuth.mockResolvedValue({ userId: author.id });
  });

  it("reorders Topics in the authorized Course", async () => {
    const response = await reorderTopics(
      body({ list: [{ id: owned.topic.id, position: 7 }] }),
      { params: Promise.resolve({ courseId: owned.course.id }) }
    );

    expect(response.status).toBe(204);
    const topic = await testDb().topic.findUnique({ where: { id: owned.topic.id } });
    expect(topic?.position).toBe(7);
  });

  it("refuses a Topic belonging to another Course, and moves nothing", async () => {
    // The whole point. Before the fix this renumbered a Topic in a Course the
    // caller has no relationship with.
    const before = await testDb().topic.findUnique({ where: { id: foreign.topic.id } });

    const response = await reorderTopics(
      body({ list: [{ id: foreign.topic.id, position: 99 }] }),
      { params: Promise.resolve({ courseId: owned.course.id }) }
    );

    expect(response.status).toBe(404);
    const after = await testDb().topic.findUnique({ where: { id: foreign.topic.id } });
    expect(after?.position).toBe(before?.position);
  });

  it("refuses a mixed list atomically, leaving the owned Topic untouched", async () => {
    // A partial application would be worse than a refusal: the caller's own
    // Course would be half-renumbered.
    const ownedBefore = await testDb().topic.findUnique({ where: { id: owned.topic.id } });

    const response = await reorderTopics(
      body({
        list: [
          { id: owned.topic.id, position: 1 },
          { id: foreign.topic.id, position: 2 },
        ],
      }),
      { params: Promise.resolve({ courseId: owned.course.id }) }
    );

    expect(response.status).toBe(404);
    const ownedAfter = await testDb().topic.findUnique({ where: { id: owned.topic.id } });
    expect(ownedAfter?.position).toBe(ownedBefore?.position);
  });

  it("refuses a well-formed uuid that names no Topic at all", async () => {
    const response = await reorderTopics(
      body({ list: [{ id: globalThis.crypto.randomUUID(), position: 1 }] }),
      { params: Promise.resolve({ courseId: owned.course.id }) }
    );

    // The same answer as "belongs to someone else", so the route cannot be used
    // to test which ids exist.
    expect(response.status).toBe(404);
  });
});

describe("PUT questions/reorder", () => {
  let author: { id: string };
  let owned: Awaited<ReturnType<typeof aQuizWithQuestion>>;
  let foreign: Awaited<ReturnType<typeof aQuizWithQuestion>>;
  let courseId: string;

  beforeEach(async () => {
    author = await aUserRow({ role: "FACULTY" });
    const course = await aCourseWithTopic(author.id);
    courseId = course.course.id;
    owned = await aQuizWithQuestion(courseId);

    const otherCourse = await aCourseWithTopic(author.id);
    foreign = await aQuizWithQuestion(otherCourse.course.id);

    clerkAuth.mockResolvedValue({ userId: author.id });
  });

  it("reorders Questions on the authorized Quiz", async () => {
    const response = await reorderQuestions(
      body({ list: [{ id: owned.question.id, position: 5 }] }),
      { params: Promise.resolve({ courseId, quizId: owned.quiz.id }) }
    );

    expect(response.status).toBe(204);
    const question = await testDb().question.findUnique({ where: { id: owned.question.id } });
    expect(question?.position).toBe(5);
  });

  it("refuses a Question from another Quiz, even one the caller also owns", async () => {
    // Ownership of both is not the issue: the route is scoped to the Quiz in the
    // URL, and a body id from elsewhere must not be applied through it.
    const before = await testDb().question.findUnique({ where: { id: foreign.question.id } });

    const response = await reorderQuestions(
      body({ list: [{ id: foreign.question.id, position: 42 }] }),
      { params: Promise.resolve({ courseId, quizId: owned.quiz.id }) }
    );

    expect(response.status).toBe(404);
    const after = await testDb().question.findUnique({ where: { id: foreign.question.id } });
    expect(after?.position).toBe(before?.position);
  });
});

describe("PATCH question options", () => {
  let author: { id: string };
  let owned: Awaited<ReturnType<typeof aQuizWithQuestion>>;
  let foreign: Awaited<ReturnType<typeof aQuizWithQuestion>>;
  let courseId: string;

  beforeEach(async () => {
    author = await aUserRow({ role: "FACULTY" });
    const course = await aCourseWithTopic(author.id);
    courseId = course.course.id;
    owned = await aQuizWithQuestion(courseId);

    const otherCourse = await aCourseWithTopic(author.id);
    foreign = await aQuizWithQuestion(otherCourse.course.id);

    clerkAuth.mockResolvedValue({ userId: author.id });
  });

  function patch(payload: unknown, questionId: string) {
    return patchQuestion(
      new Request("http://localhost/api", {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ courseId, quizId: owned.quiz.id, questionId }) }
    );
  }

  it("updates the question's own options", async () => {
    const response = await patch(
      {
        text: "Updated?",
        options: [
          { id: owned.correct.id, text: "Still right", isCorrect: true, position: 1 },
          { text: "A new one", isCorrect: false, position: 2 },
        ],
      },
      owned.question.id
    );

    expect(response.status).toBe(200);
    const options = await testDb().questionOption.findMany({
      where: { questionId: owned.question.id },
      orderBy: { position: "asc" },
    });
    expect(options.map((o) => o.text)).toEqual(["Still right", "A new one"]);
    // The option that was not resubmitted is removed.
    expect(options).toHaveLength(2);
  });

  it("refuses an option id from another question, and changes nothing", async () => {
    // Before the fix this rewrote the text of -- and could flip `isCorrect` on --
    // an option belonging to a different quiz's question. A uuid from elsewhere
    // is still a valid uuid, so nothing else rejected it.
    const response = await patch(
      {
        options: [
          { id: foreign.correct.id, text: "Hijacked", isCorrect: false, position: 1 },
        ],
      },
      owned.question.id
    );

    expect(response.status).toBe(404);

    const untouched = await testDb().questionOption.findUnique({
      where: { id: foreign.correct.id },
    });
    expect(untouched?.text).toBe("Right");
    expect(untouched?.isCorrect).toBe(true);

    // And the owned question's options were not deleted on the way through.
    const owndedOptions = await testDb().questionOption.count({
      where: { questionId: owned.question.id },
    });
    expect(owndedOptions).toBe(2);
  });

  it("rolls the whole update back when one option is foreign", async () => {
    // The delete-then-recreate sequence used to run outside a transaction, so a
    // failure partway left a question whose options had been deleted but not
    // replaced -- an unanswerable question on a published quiz.
    const response = await patch(
      {
        text: "Should not persist",
        options: [
          { id: owned.correct.id, text: "Kept", isCorrect: true, position: 1 },
          { id: foreign.wrong.id, text: "Foreign", isCorrect: false, position: 2 },
        ],
      },
      owned.question.id
    );

    expect(response.status).toBe(404);

    const question = await testDb().question.findUnique({
      where: { id: owned.question.id },
      include: { options: true },
    });
    expect(question?.text).toBe("Which?");
    expect(question?.options).toHaveLength(2);
  });

  it("rejects a non-uuid questionId before touching the database", async () => {
    const response = await patch({ text: "x" }, "not-a-uuid");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_parameter" },
    });
  });
});
