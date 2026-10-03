import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const mocks = vi.hoisted(() => ({
  findPublishedTopicInCourse: vi.fn(),
  topicEntitlement: vi.fn(),
  markCourseCompleted: vi.fn(),
  evaluateBadges: vi.fn(),
  issueCertificate: vi.fn(),
  recordStreakActivity: vi.fn(),
  appendEvents: vi.fn(),
}));
vi.mock("@/lib/courses/topic-access", () => ({ findPublishedTopicInCourse: mocks.findPublishedTopicInCourse }));
vi.mock("@/lib/entitlement", () => ({
  topicEntitlement: mocks.topicEntitlement,
  markCourseCompleted: mocks.markCourseCompleted,
}));
vi.mock("@/lib/badge-service", () => ({ evaluateBadges: mocks.evaluateBadges }));
vi.mock("@/lib/certificate-service", () => ({ issueCertificate: mocks.issueCertificate }));
vi.mock("@/lib/streak-service", () => ({ recordStreakActivity: mocks.recordStreakActivity }));
vi.mock("@/lib/outbox/events", () => ({ appendEvents: mocks.appendEvents }));

const { completionLockKey, setTopicCompletion } = await import("@/lib/courses/complete-topic");

/**
 * The completion command's decisions (#49): which facts follow from which
 * state, and which events record them. Real transactions, locking, and
 * rollback are proven against PostgreSQL in
 * tests/integration/learning-completion.test.ts.
 */
const learner = { userId: "u1", role: "STUDENT" as const };
const NOW = new Date("2026-05-10T12:00:00Z");

function modules(done: Record<string, boolean>) {
  // Module m1 holds t1 and t2; module m2 holds t3.
  const topic = (id: string) => ({ id, userProgress: done[id] ? [{ isCompleted: true }] : [] });
  return [
    { id: "m1", title: "Foundations", topics: [topic("t1"), topic("t2")] },
    { id: "m2", title: "Practice", topics: [topic("t3")] },
  ];
}

function eventTypes(): string[] {
  return (mocks.appendEvents.mock.calls.at(-1)?.[1] ?? []).map((e: { type: string }) => e.type);
}

beforeEach(() => {
  mocks.findPublishedTopicInCourse.mockResolvedValue({ id: "t1", moduleId: "m1" });
  mocks.topicEntitlement.mockResolvedValue({ canReadTopic: true });
  mocks.markCourseCompleted.mockResolvedValue(true);
  mocks.evaluateBadges.mockResolvedValue([]);
  mocks.issueCertificate.mockResolvedValue({ certificateId: "cert1", certificateNumber: "GHELP-2026-00001", created: true });
  mocks.recordStreakActivity.mockResolvedValue(3);
  mocks.appendEvents.mockResolvedValue(1);
  dbMock.userProgress.upsert.mockImplementation(async ({ create }: { create: object }) => ({ id: "p1", ...create }));
});

describe("setTopicCompletion", () => {
  it("answers not_found for a Topic that is not published in this Course", async () => {
    mocks.findPublishedTopicInCourse.mockResolvedValue(null);

    await expect(setTopicCompletion(learner, "c1", "t1", true, NOW)).resolves.toEqual({ kind: "not_found" });
    expect(dbMock.userProgress.upsert).not.toHaveBeenCalled();
  });

  it("answers not_found when the learner may not read the Topic", async () => {
    mocks.topicEntitlement.mockResolvedValue({ canReadTopic: false });

    await expect(setTopicCompletion(learner, "c1", "t1", true, NOW)).resolves.toEqual({ kind: "not_found" });
  });

  it("serialises on one lock per learner per Course", async () => {
    await setTopicCompletion(learner, "c1", "t1", true, NOW);

    const [, key] = (dbMock.$executeRaw as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(key).toBe(completionLockKey("u1", "c1"));
    expect(completionLockKey("u1", "c1")).toBe("learning-completion:u1:c1");
  });

  it("does nothing on a repeat of the current state", async () => {
    dbMock.userProgress.findUnique.mockResolvedValue({ id: "p1", isCompleted: true });

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome).toMatchObject({ kind: "recorded", changed: false, awardedBadges: [] });
    expect(dbMock.userProgress.upsert).not.toHaveBeenCalled();
    expect(mocks.appendEvents).not.toHaveBeenCalled();
  });

  it("records an uncompletion and nothing else", async () => {
    dbMock.userProgress.findUnique.mockResolvedValue({ id: "p1", isCompleted: true });

    const outcome = await setTopicCompletion(learner, "c1", "t1", false, NOW);

    expect(outcome).toMatchObject({ changed: true, courseCompleted: false, completedModule: null });
    expect(eventTypes()).toEqual(["TOPIC_UNCOMPLETED"]);
    expect(mocks.recordStreakActivity).not.toHaveBeenCalled();
    expect(mocks.markCourseCompleted).not.toHaveBeenCalled();
  });

  it("records a Topic that finishes nothing", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true }));

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome).toMatchObject({ completedModule: null, courseCompleted: false, certificate: null });
    expect(eventTypes()).toEqual(["TOPIC_COMPLETED"]);
    expect(mocks.recordStreakActivity).toHaveBeenCalledWith(expect.anything(), "u1", NOW);
  });

  it("records a finished Module", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true, t2: true }));

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome).toMatchObject({ completedModule: { id: "m1", title: "Foundations" }, courseCompleted: false });
    expect(eventTypes()).toEqual(["TOPIC_COMPLETED", "MODULE_COMPLETED"]);
    expect(mocks.evaluateBadges).toHaveBeenCalledWith("u1", { type: "module_completed", moduleId: "m1" }, expect.anything());
  });

  it("finishes the Course: Enrollment, Certificate, and every event", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true, t2: true, t3: true }));
    mocks.evaluateBadges.mockImplementation(async (_u: string, e: { type: string }) =>
      e.type === "course_completed" ? [{ id: "b1", name: "Champion" }] : []
    );

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome).toMatchObject({
      courseCompleted: true,
      certificate: { certificateId: "cert1", certificateNumber: "GHELP-2026-00001" },
      awardedBadges: [{ id: "b1" }],
    });
    expect(mocks.markCourseCompleted).toHaveBeenCalledWith("u1", "c1", expect.anything());
    expect(mocks.issueCertificate).toHaveBeenCalledWith(expect.anything(), "u1", "c1", NOW);
    expect(eventTypes()).toEqual([
      "TOPIC_COMPLETED",
      "MODULE_COMPLETED",
      "COURSE_COMPLETED",
      "CERTIFICATE_ISSUED",
      "BADGE_AWARDED",
    ]);
  });

  it("does not record a Certificate the learner already held", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true, t2: true, t3: true }));
    mocks.issueCertificate.mockResolvedValue({ certificateId: "old", certificateNumber: "GHELP-2025-00002", created: false });

    await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(eventTypes()).not.toContain("CERTIFICATE_ISSUED");
  });

  it("does not finish the Course for an Enrollment that is not ACTIVE", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true, t2: true, t3: true }));
    mocks.markCourseCompleted.mockResolvedValue(false);

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome).toMatchObject({ courseCompleted: false, certificate: null });
    expect(mocks.issueCertificate).not.toHaveBeenCalled();
    expect(eventTypes()).not.toContain("COURSE_COMPLETED");
  });

  it("does not finish a Module the Topic's Module is not published in", async () => {
    mocks.findPublishedTopicInCourse.mockResolvedValue({ id: "t1", moduleId: "unpublished" });
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true, t2: true }));

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome).toMatchObject({ completedModule: null });
  });

  it("records each awarded Badge once, however many triggers award it", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({ t1: true }));
    mocks.evaluateBadges.mockResolvedValue([{ id: "b1" }]);

    const outcome = await setTopicCompletion(learner, "c1", "t1", true, NOW);

    expect(outcome.kind === "recorded" && outcome.awardedBadges).toEqual([{ id: "b1" }]);
    expect(eventTypes().filter((t) => t === "BADGE_AWARDED")).toHaveLength(1);
  });

  it("uses the real clock by default", async () => {
    dbMock.module.findMany.mockResolvedValue(modules({}));

    await setTopicCompletion(learner, "c1", "t1", true);

    expect(mocks.recordStreakActivity.mock.calls[0][2]).toBeInstanceOf(Date);
  });
});
