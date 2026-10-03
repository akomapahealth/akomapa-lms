import { beforeEach, describe, expect, it, vi } from "vitest";

import { BODY_BYTES } from "@/lib/http/limits";

import { SAME_ORIGIN_HEADERS } from "../../support/origin";
import { dbMock } from "../support/db";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth, currentUser: vi.fn() }));
vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));
vi.mock("@/lib/badge-service", () => ({ evaluateBadges: vi.fn().mockResolvedValue([]) }));
// These tests are about the request contract. Rate limiting has its own suite
// (tests/unit/rate-limit, tests/integration/rate-limit-*.test.ts); here it is a
// no-op so a limit can never be what a contract assertion observes.
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(undefined) }));

// Two route modules build a Mux client at import time from env that the unit
// harness deliberately does not set. Mocked rather than given fake credentials,
// because no test here should be able to reach Mux even by accident.
vi.mock("@mux/mux-node", () => {
  class Mux {
    video = { assets: { create: vi.fn(), delete: vi.fn() } };
  }
  return { default: Mux, Mux };
});

const { POST: createCourse } = await import("@/app/api/courses/route");
const { PATCH: patchCourse } = await import("@/app/api/courses/[courseId]/route");
const { PUT: reorderTopics } = await import(
  "@/app/api/courses/[courseId]/chapters/reorder/route"
);
const { PUT: writeProgress } = await import(
  "@/app/api/courses/[courseId]/chapters/[chapterId]/progress/route"
);
const { POST: createPost } = await import("@/app/api/community/posts/route");
const { POST: createJournal } = await import("@/app/api/journal/route");
const { PATCH: patchSettings } = await import("@/app/api/settings/route");
const { POST: submitQuiz } = await import(
  "@/app/api/courses/[courseId]/quizzes/[quizId]/submit/route"
);

const COURSE = "11111111-1111-4111-8111-111111111111";
const TOPIC = "22222222-2222-4222-8222-222222222222";
const QUIZ = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";

/** Every write delegate the double exposes, so "nothing was written" is checkable. */
const WRITES = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"] as const;

function writeCalls(...models: string[]): number {
  return models.reduce(
    (total, model) =>
      total +
      WRITES.reduce((sum, method) => sum + (dbMock[model]?.[method]?.mock.calls.length ?? 0), 0),
    0
  );
}

function request(body: unknown, contentType: string | null = "application/json") {
  return new Request("http://localhost/api", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      ...SAME_ORIGIN_HEADERS,
      ...(contentType === null ? {} : { "content-type": contentType }),
    },
  });
}

async function codeOf(response: Response): Promise<string> {
  return (await response.json()).error.code;
}

beforeEach(() => {
  // An ADMIN principal, so capability checks pass and the tests isolate
  // validation rather than authorization (which is #42's suite).
  clerkAuth.mockResolvedValue({ userId: "user_admin" });
  dbMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });
});

/**
 * The response contract, exercised through real handlers (#44).
 *
 * Each case asserts two things: the documented status and code, and that the
 * request wrote nothing. The second is the point -- before this, an unbounded or
 * wrongly typed body reached Prisma and either wrote a bad row or failed as a
 * 500.
 */
describe("malformed JSON", () => {
  it.each([
    ["POST /api/courses", () => createCourse(request("{oops"))],
    ["POST /api/community/posts", () => createPost(request("{"))],
    ["POST /api/journal", () => createJournal(request("[1,2"))],
    ["PATCH /api/settings", () => patchSettings(request("'nope'"))],
  ])("%s answers 400 malformed_json and writes nothing", async (_label, run) => {
    const response = await run();

    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("malformed_json");
    expect(writeCalls("course", "forumPost", "journalEntry", "userSettings")).toBe(0);
  });
});

describe("unsupported media type", () => {
  it.each([
    ["text/plain", "text/plain"],
    ["form encoding", "application/x-www-form-urlencoded"],
  ])("POST /api/courses refuses %s with 415", async (_label, contentType) => {
    const response = await createCourse(request({ title: "Ethics" }, contentType));

    expect(response.status).toBe(415);
    expect(await codeOf(response)).toBe("unsupported_media_type");
    expect(writeCalls("course")).toBe(0);
  });

  it("refuses a body with no Content-Type at all", async () => {
    const bare = new Request("http://localhost/api", { method: "POST", body: "{}" });
    Object.defineProperty(bare, "headers", { value: new Headers(SAME_ORIGIN_HEADERS) });

    expect(await codeOf(await createCourse(bare))).toBe("unsupported_media_type");
  });
});

describe("unknown fields", () => {
  it("POST /api/courses refuses a caller-supplied userId", async () => {
    // Ownership is set from the principal. Accepting it from the body is how a
    // create route lets a caller assign someone else's row.
    const response = await createCourse(request({ title: "Ethics", userId: "user_someone" }));

    expect(response.status).toBe(422);
    expect(await codeOf(response)).toBe("validation_failed");
    expect(writeCalls("course")).toBe(0);
  });

  it("POST /api/community/posts refuses isPinned", async () => {
    const response = await createPost(
      request({ title: "t", content: "<p>c</p>", categoryId: COURSE, isPinned: true })
    );

    expect(await codeOf(response)).toBe("validation_failed");
    expect(writeCalls("forumPost")).toBe(0);
  });

  it("names the refused key in fields, without describing the schema", async () => {
    const response = await createCourse(request({ title: "Ethics", isAdmin: true }));
    const { error } = await response.json();

    expect(error.fields).toEqual([{ path: "isAdmin", code: "unrecognized_keys" }]);
    expect(JSON.stringify(error)).not.toContain("ZodError");
  });
});

describe("oversized payloads", () => {
  it("POST /api/courses refuses a body past the default limit", async () => {
    const response = await createCourse(
      request({ title: "x".repeat(BODY_BYTES.default + 100) })
    );

    expect(response.status).toBe(413);
    expect(await codeOf(response)).toBe("payload_too_large");
    expect(writeCalls("course")).toBe(0);
  });

  it("POST /api/community/posts allows rich text but still has a ceiling", async () => {
    // Its limit is the rich-text one, not the default: a long post is legitimate,
    // an unbounded one is not.
    const tooBig = await createPost(
      request({
        title: "t",
        content: "x".repeat(BODY_BYTES.richText + 100),
        categoryId: COURSE,
      })
    );

    expect(tooBig.status).toBe(413);
    expect(writeCalls("forumPost")).toBe(0);
  });
});

describe("invalid path parameters", () => {
  it("PATCH /api/courses/[courseId] refuses a non-uuid id before querying", async () => {
    const response = await patchCourse(request({ title: "New" }), {
      params: Promise.resolve({ courseId: "not-a-uuid" }),
    });

    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe("invalid_parameter");
    // The id never reached a query, let alone a write.
    expect(dbMock.course.findFirst).not.toHaveBeenCalled();
    expect(writeCalls("course")).toBe(0);
  });

  it("PUT progress refuses a non-uuid chapterId", async () => {
    const response = await writeProgress(request({ isCompleted: true }), {
      params: Promise.resolve({ courseId: COURSE, chapterId: "../../etc/passwd" }),
    });

    expect(await codeOf(response)).toBe("invalid_parameter");
    expect(writeCalls("userProgress")).toBe(0);
  });

  it("GET-shaped ids are not accepted as uuid prefixes", async () => {
    const response = await patchCourse(request({ title: "New" }), {
      params: Promise.resolve({ courseId: `${COURSE}extra` }),
    });

    expect(await codeOf(response)).toBe("invalid_parameter");
  });
});

describe("boundary and type checking on values", () => {
  it("PUT progress refuses a non-boolean isCompleted", async () => {
    // The value drives Enrollment status and certificate issuance.
    const response = await writeProgress(request({ isCompleted: "true" }), {
      params: Promise.resolve({ courseId: COURSE, chapterId: TOPIC }),
    });

    expect(response.status).toBe(422);
    expect(writeCalls("userProgress", "enrollment")).toBe(0);
  });

  it("PUT progress validates the body before looking the Topic up", async () => {
    // Order matters: an unparseable body should not cost a query.
    await writeProgress(request({ isCompleted: 1 }), {
      params: Promise.resolve({ courseId: COURSE, chapterId: TOPIC }),
    });

    expect(dbMock.topic.findFirst).not.toHaveBeenCalled();
    expect(dbMock.purchase.findUnique).not.toHaveBeenCalled();
  });

  it("PATCH /api/courses refuses an infinite price", async () => {
    // Sent as raw text, not via JSON.stringify: `JSON.stringify(1e999)` emits
    // `null`, whereas `JSON.parse('{"price":1e999}')` yields `Infinity`. The
    // overflowing literal is the actual way an infinite price arrives, and it
    // passed the old `z.number().min(0)` and reached Math.round(price * 100).
    // The Course is stubbed because authorization deliberately runs first: a
    // caller who may not touch the resource learns nothing about its schema.
    dbMock.course.findFirst.mockResolvedValue({ id: COURSE, userId: "user_admin" });

    const response = await patchCourse(request('{"price":1e999}'), {
      params: Promise.resolve({ courseId: COURSE }),
    });

    expect(response.status).toBe(422);
    expect(writeCalls("course")).toBe(0);
  });

  it("PATCH /api/courses refuses an empty update", async () => {
    dbMock.course.findFirst.mockResolvedValue({ id: COURSE, userId: "user_admin" });

    const response = await patchCourse(request({}), {
      params: Promise.resolve({ courseId: COURSE }),
    });

    expect(response.status).toBe(422);
    expect(writeCalls("course")).toBe(0);
  });
});

describe("collection bounds", () => {
  it("PUT chapters/reorder refuses a list past the count limit", async () => {
    // 501 entries, inside the route's byte ceiling, so the count bound is what
    // rejects it. With the default 16KB limit this came back as 413 instead,
    // which made COUNT.reorder unreachable and misreported the reason.
    const list = Array.from({ length: 501 }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      position: i,
    }));
    dbMock.course.findFirst.mockResolvedValue({ id: COURSE, userId: "user_admin" });

    const response = await reorderTopics(request({ list }), {
      params: Promise.resolve({ courseId: COURSE }),
    });

    expect(response.status).toBe(422);
    expect(writeCalls("topic")).toBe(0);
  });

  it("PUT chapters/reorder refuses a duplicated id", async () => {
    dbMock.course.findFirst.mockResolvedValue({ id: COURSE, userId: "user_admin" });

    const response = await reorderTopics(
      request({ list: [{ id: TOPIC, position: 0 }, { id: TOPIC, position: 1 }] }),
      { params: Promise.resolve({ courseId: COURSE }) }
    );

    expect(response.status).toBe(422);
    expect(writeCalls("topic")).toBe(0);
  });

  it("PUT chapters/reorder accepts a full-length list on size", async () => {
    // The complement of the case above: 500 entries must not be rejected as too
    // large, or the count limit is decorative.
    const list = Array.from({ length: 500 }, (_, i) => ({
      id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
      position: i,
    }));
    dbMock.course.findFirst.mockResolvedValue({ id: COURSE, userId: "user_admin" });
    dbMock.topic.findMany.mockResolvedValue(list.map((item) => ({ id: item.id })));
    dbMock.topic.update.mockResolvedValue({});

    const response = await reorderTopics(request({ list }), {
      params: Promise.resolve({ courseId: COURSE }),
    });

    expect(response.status).toBe(204);
  });

  it("POST quiz submit refuses two answers to one question", async () => {
    const answers = [
      { questionId: TOPIC, selectedOptionId: QUIZ },
      { questionId: TOPIC, selectedOptionId: COURSE },
    ];

    const response = await submitQuiz(request({ attemptId: ATTEMPT, answers }), {
      params: Promise.resolve({ courseId: COURSE, quizId: QUIZ }),
    });

    expect(response.status).toBe(422);
    expect(writeCalls("quizAttempt", "quizAnswer")).toBe(0);
  });

  it("POST quiz submit refuses non-uuid answer ids", async () => {
    const answers = [{ questionId: "q1", selectedOptionId: "o1" }];

    const response = await submitQuiz(request({ attemptId: ATTEMPT, answers }), {
      params: Promise.resolve({ courseId: COURSE, quizId: QUIZ }),
    });

    expect(response.status).toBe(422);
    expect(writeCalls("quizAttempt", "quizAnswer")).toBe(0);
  });
});

describe("every failure carries a correlation id", () => {
  it.each([
    ["malformed_json", () => createCourse(request("{"))],
    ["validation_failed", () => createCourse(request({ title: "" }))],
    ["payload_too_large", () => createCourse(request({ title: "x".repeat(20000) }))],
    ["unsupported_media_type", () => createCourse(request({ title: "a" }, "text/plain"))],
  ])("%s", async (expected, run) => {
    const response = await run();
    const { error } = await response.json();

    expect(error.code).toBe(expected);
    expect(error.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(response.headers.get("x-correlation-id")).toBe(error.correlationId);
  });
});
