import { beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import { anEnrollmentRow, aUserRow } from "./support/fixtures";

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

// Lets a test make the last write of the command fail, to prove the whole
// command rolls back with it.
const failEvents = vi.hoisted(() => ({ next: false }));
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
vi.mock("@/lib/outbox/events", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/outbox/events")>();
  return {
    ...original,
    appendEvents: vi.fn(async (...args: Parameters<typeof original.appendEvents>) => {
      if (failEvents.next) {
        failEvents.next = false;
        throw new Error("outbox unavailable");
      }
      return original.appendEvents(...args);
    }),
  };
});

const { setTopicCompletion } = await import("@/lib/courses/complete-topic");
const { PUT: putProgress } = await import(
  "@/app/api/courses/[courseId]/chapters/[chapterId]/progress/route"
);

/**
 * The learning-completion command against real PostgreSQL (#49, ADR 0004).
 */

const NOW = new Date("2026-05-10T12:00:00Z");
let unique = 0;
const id = () => globalThis.crypto.randomUUID();

interface World {
  learner: { id: string; role: "STUDENT" };
  courseId: string;
  moduleA: string;
  moduleB: string;
  topics: string[];
}

/** A published Course: Module A with two Topics, Module B with one. */
async function aCourse(): Promise<World> {
  const author = await aUserRow({ role: "FACULTY" });
  const learner = await aUserRow();
  const courseId = id();
  await testDb().course.create({ data: { id: courseId, userId: author.id, title: "Ethics", isPublished: true } });
  const moduleA = id();
  const moduleB = id();
  await testDb().module.createMany({
    data: [
      { id: moduleA, courseId, title: "Foundations", position: 1, isPublished: true },
      { id: moduleB, courseId, title: "Practice", position: 2, isPublished: true },
    ],
  });
  const topics = [id(), id(), id()];
  await testDb().topic.createMany({
    data: [
      { id: topics[0], moduleId: moduleA, title: "T1", position: 1, isPublished: true },
      { id: topics[1], moduleId: moduleA, title: "T2", position: 2, isPublished: true },
      { id: topics[2], moduleId: moduleB, title: "T3", position: 1, isPublished: true },
    ],
  });
  await anEnrollmentRow(learner.id, courseId, "ACTIVE");
  return { learner: { id: learner.id, role: "STUDENT" }, courseId, moduleA, moduleB, topics };
}

const principal = (w: World) => ({ userId: w.learner.id, role: "STUDENT" as const });
const complete = (w: World, topic: string, done = true) =>
  setTopicCompletion(principal(w), w.courseId, topic, done, NOW);

async function eventTypes(): Promise<string[]> {
  const rows = await testDb().outboxEvent.findMany({ orderBy: { occurredAt: "asc" } });
  return rows.map((r) => r.type).sort();
}

async function enrollmentStatus(w: World) {
  return (await testDb().enrollment.findFirstOrThrow({ where: { userId: w.learner.id, courseId: w.courseId } })).status;
}

let w: World;

beforeEach(async () => {
  unique += 1;
  failEvents.next = false;
  failBadges.next = false;
  w = await aCourse();
  await testDb().badge.create({
    data: { name: `First Steps ${unique}`, description: "d", type: "COMPLETION", criteria: { type: "topics_completed", count: 1 } },
  });
});

describe("completing Topics", () => {
  it("records a Topic and its events without finishing anything early", async () => {
    const outcome = await complete(w, w.topics[0]);

    expect(outcome).toMatchObject({ kind: "recorded", changed: true, completedModule: null, courseCompleted: false });
    expect(await enrollmentStatus(w)).toBe("ACTIVE");
    expect(await eventTypes()).toEqual(["BADGE_AWARDED", "TOPIC_COMPLETED"]);
    expect((await testDb().learningStreak.findUniqueOrThrow({ where: { userId: w.learner.id } })).currentStreak).toBe(1);
  });

  it("finishes a Module when its last Topic is done", async () => {
    await complete(w, w.topics[0]);
    const outcome = await complete(w, w.topics[1]);

    expect(outcome).toMatchObject({ completedModule: { id: w.moduleA, title: "Foundations" }, courseCompleted: false });
    expect(await eventTypes()).toContain("MODULE_COMPLETED");
  });

  it("finishes the Course in the same commit: Enrollment, Certificate, and events", async () => {
    for (const topic of w.topics) await complete(w, topic);

    expect(await enrollmentStatus(w)).toBe("COMPLETED");
    const certificate = await testDb().certificate.findUniqueOrThrow({
      where: { userId_courseId: { userId: w.learner.id, courseId: w.courseId } },
    });
    // The row and its number exist; the PDF is rendered later, outside the transaction.
    expect(certificate.certificateNumber).toBe("GHELP-2026-00001");
    expect(certificate.pdfUrl).toBeNull();
    const types = await eventTypes();
    expect(types.filter((t) => t === "COURSE_COMPLETED")).toHaveLength(1);
    expect(types.filter((t) => t === "CERTIFICATE_ISSUED")).toHaveLength(1);
    expect(types.filter((t) => t === "MODULE_COMPLETED")).toHaveLength(2);
    expect(types.filter((t) => t === "BADGE_AWARDED")).toHaveLength(1);
  });

  it("changes nothing and records nothing when a request repeats", async () => {
    await complete(w, w.topics[0]);
    const before = await testDb().outboxEvent.count();

    const outcome = await complete(w, w.topics[0]);

    expect(outcome).toMatchObject({ changed: false, awardedBadges: [] });
    expect(await testDb().outboxEvent.count()).toBe(before);
  });

  it("rolls back every write when any part of the command fails", async () => {
    await complete(w, w.topics[0]);
    await complete(w, w.topics[1]);
    failEvents.next = true;

    await expect(complete(w, w.topics[2])).rejects.toThrow("outbox unavailable");

    // The last Topic, the Course completion, the Certificate: none of it.
    const progress = await testDb().userProgress.findUnique({
      where: { userId_topicId: { userId: w.learner.id, topicId: w.topics[2] } },
    });
    expect(progress).toBeNull();
    expect(await enrollmentStatus(w)).toBe("ACTIVE");
    expect(await testDb().certificate.count()).toBe(0);
    expect(await eventTypes()).not.toContain("COURSE_COMPLETED");

    // And a retry succeeds cleanly.
    await expect(complete(w, w.topics[2])).resolves.toMatchObject({ courseCompleted: true });
  });
});

describe("concurrency", () => {
  it("finishes the Course exactly once when the last two Topics complete at once", async () => {
    // Each would have read the other Topic as incomplete; the per-learner lock
    // makes the second see the first.
    for (let round = 0; round < 3; round += 1) {
      const world = await aCourse();
      await complete(world, world.topics[0]);

      const outcomes = await Promise.all([complete(world, world.topics[1]), complete(world, world.topics[2])]);

      expect(outcomes.filter((o) => o.kind === "recorded" && o.courseCompleted)).toHaveLength(1);
      expect(await enrollmentStatus(world)).toBe("COMPLETED");
      expect(await testDb().certificate.count({ where: { userId: world.learner.id } })).toBe(1);
    }
  });

  it("records one completion when the same request arrives twice at once", async () => {
    const outcomes = await Promise.all([complete(w, w.topics[0]), complete(w, w.topics[0])]);

    expect(outcomes.filter((o) => o.kind === "recorded" && o.changed)).toHaveLength(1);
    expect((await eventTypes()).filter((t) => t === "TOPIC_COMPLETED")).toHaveLength(1);
  });
});

describe("the progress route", () => {
  it("finishes the Course once when the last two Topics are marked at once", async () => {
    // The regression at the route boundary, so it runs against any
    // implementation of the handler: separate writes let both requests read
    // the other Topic as incomplete, and the Course was never finished.
    const request = (topic: string) =>
      putProgress(
        new Request(`http://localhost:3000/api/courses/${w.courseId}/chapters/${topic}/progress`, {
          method: "PUT",
          headers: { origin: "http://localhost:3000", "content-type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        }),
        { params: Promise.resolve({ courseId: w.courseId, chapterId: topic }) }
      );
    clerkAuth.mockResolvedValue({ userId: w.learner.id });
    await request(w.topics[0]);

    const [first, second] = await Promise.all([request(w.topics[1]), request(w.topics[2])]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await enrollmentStatus(w)).toBe("COMPLETED");
    expect(await testDb().certificate.count({ where: { userId: w.learner.id } })).toBe(1);
  });
});

describe("the progress route under failure", () => {
  it("leaves no partial completion when a later step fails", async () => {
    // Before #49 the progress row and the Enrollment were committed by
    // separate statements before badges ran, so a failure there answered 500
    // with the Topic and the Course already marked complete.
    const put = (topic: string) =>
      putProgress(
        new Request(`http://localhost:3000/api/courses/${w.courseId}/chapters/${topic}/progress`, {
          method: "PUT",
          headers: { origin: "http://localhost:3000", "content-type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        }),
        { params: Promise.resolve({ courseId: w.courseId, chapterId: topic }) }
      );
    clerkAuth.mockResolvedValue({ userId: w.learner.id });
    await put(w.topics[0]);
    await put(w.topics[1]);
    failBadges.next = true;

    const response = await put(w.topics[2]);

    expect(response.status).toBe(500);
    const progress = await testDb().userProgress.findUnique({
      where: { userId_topicId: { userId: w.learner.id, topicId: w.topics[2] } },
    });
    expect(progress?.isCompleted ?? false).toBe(false);
    expect(await enrollmentStatus(w)).toBe("ACTIVE");
  });
});

describe("uncompleting", () => {
  it("changes only the Topic: completion, Certificate, and Badges are history", async () => {
    for (const topic of w.topics) await complete(w, topic);

    const outcome = await complete(w, w.topics[0], false);

    expect(outcome).toMatchObject({ changed: true, courseCompleted: false });
    expect(await enrollmentStatus(w)).toBe("COMPLETED");
    expect(await testDb().certificate.count()).toBe(1);
    expect(await testDb().userBadge.count()).toBe(1);
    expect(await eventTypes()).toContain("TOPIC_UNCOMPLETED");
  });

  it("does not record a second Module completion after uncompleting and redoing a Topic", async () => {
    await complete(w, w.topics[0]);
    await complete(w, w.topics[1]);
    await complete(w, w.topics[1], false);
    await complete(w, w.topics[1]);

    expect((await eventTypes()).filter((t) => t === "MODULE_COMPLETED")).toHaveLength(1);
    expect((await eventTypes()).filter((t) => t === "TOPIC_COMPLETED")).toHaveLength(3);
  });

  it("uncompleting a Topic never completed records it as incomplete", async () => {
    await expect(complete(w, w.topics[0], false)).resolves.toMatchObject({ changed: true });
  });
});

describe("eligible content", () => {
  it("refuses an unpublished Topic", async () => {
    await testDb().topic.update({ where: { id: w.topics[2] }, data: { isPublished: false } });

    await expect(complete(w, w.topics[2])).resolves.toEqual({ kind: "not_found" });
  });

  it("ignores unpublished Topics when deciding the Course is finished", async () => {
    await testDb().topic.update({ where: { id: w.topics[2] }, data: { isPublished: false } });

    await complete(w, w.topics[0]);
    const outcome = await complete(w, w.topics[1]);

    expect(outcome).toMatchObject({ courseCompleted: true });
  });

  it("neither blocks nor manufactures completion with an empty Module", async () => {
    await testDb().module.create({
      data: { id: id(), courseId: w.courseId, title: "Empty", position: 3, isPublished: true },
    });

    for (const topic of w.topics) await complete(w, topic);

    expect(await enrollmentStatus(w)).toBe("COMPLETED");
  });

  it("refuses a Topic from another Course", async () => {
    const other = await aCourse();

    await expect(setTopicCompletion(principal(w), w.courseId, other.topics[0], true, NOW)).resolves.toEqual({
      kind: "not_found",
    });
  });
});

describe("entitlement", () => {
  it("refuses a suspended learner", async () => {
    await testDb().enrollment.updateMany({ where: { userId: w.learner.id }, data: { status: "SUSPENDED" } });

    await expect(complete(w, w.topics[0])).resolves.toEqual({ kind: "not_found" });
    expect(await testDb().userProgress.count()).toBe(0);
  });

  it("records a preview learner's free Topic without completing the Course", async () => {
    const visitor = await aUserRow();
    await testDb().topic.updateMany({ where: { id: { in: w.topics } }, data: { isFree: true } });

    for (const topic of w.topics) {
      await setTopicCompletion({ userId: visitor.id, role: "STUDENT" }, w.courseId, topic, true, NOW);
    }

    expect(await testDb().userProgress.count({ where: { userId: visitor.id, isCompleted: true } })).toBe(3);
    expect(await testDb().certificate.count({ where: { userId: visitor.id } })).toBe(0);
    expect(await eventTypes()).not.toContain("COURSE_COMPLETED");
  });
});
