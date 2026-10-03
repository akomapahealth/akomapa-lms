import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { markCourseCompleted, recordFreeEnrollment, recordPaidEnrollment } =
  await import("@/lib/entitlement/enroll");

beforeEach(() => {
  dbMock.purchase.upsert.mockResolvedValue({});
  dbMock.enrollment.upsert.mockResolvedValue({});
});

/**
 * Creating entitlement (#48, ADR 0002).
 *
 * The webhook used to write only a Purchase row, which was enough while access
 * was read from Purchase. Once Enrollment is canonical, a payment that records no
 * Enrollment buys nothing.
 */
describe("recordPaidEnrollment", () => {
  it("writes the Purchase and the Enrollment together", async () => {
    await recordPaidEnrollment("user_1", "course_1");

    expect(dbMock.purchase.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
      create: { userId: "user_1", courseId: "course_1" },
      update: {},
    });
    expect(dbMock.enrollment.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: "user_1", courseId: "course_1" } },
      create: { userId: "user_1", courseId: "course_1", status: "ACTIVE" },
      update: {},
    });
  });

  // Atomicity is asserted against a real database in
  // tests/integration/entitlement.test.ts. The unit double hands out a fresh
  // `$transaction` mock on each property access and runs the callback inline, so
  // "these two writes commit together" is not observable here -- and a partial
  // failure leaving a Purchase with no Enrollment is exactly the kind of claim
  // that deserves a real transaction rather than a mock.

  it("is idempotent: both writes are upserts with an empty update", async () => {
    // A webhook is delivered at least once, so a redelivery must change nothing.
    await recordPaidEnrollment("user_1", "course_1");

    expect(dbMock.purchase.upsert.mock.calls[0][0].update).toEqual({});
    expect(dbMock.enrollment.upsert.mock.calls[0][0].update).toEqual({});
  });

  it("never resets an existing Enrollment's status", async () => {
    // The empty `update` is the mechanism. A learner who was suspended, or who has
    // already completed the Course, must not be flipped back to ACTIVE by a
    // webhook redelivery.
    await recordPaidEnrollment("user_1", "course_1");

    const call = dbMock.enrollment.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty("status");
  });

  it("joins a caller's transaction when given one", async () => {
    // So the Stripe path can commit the pair with whatever else it writes.
    const tx = {
      purchase: { upsert: vi.fn().mockResolvedValue({}) },
      enrollment: { upsert: vi.fn().mockResolvedValue({}) },
    };

    await recordPaidEnrollment("user_1", "course_1", tx as never);

    expect(tx.purchase.upsert).toHaveBeenCalled();
    expect(tx.enrollment.upsert).toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("recordFreeEnrollment", () => {
  it("writes an Enrollment and no Purchase", async () => {
    // A free Course, a scholarship, or a staff account. No payment happened, so
    // there is no evidence of one to record.
    await recordFreeEnrollment("user_1", "course_1");

    expect(dbMock.enrollment.upsert).toHaveBeenCalled();
    expect(dbMock.purchase.upsert).not.toHaveBeenCalled();
  });

  it("does not reset an existing status", async () => {
    await recordFreeEnrollment("user_1", "course_1");

    expect(dbMock.enrollment.upsert.mock.calls[0][0].update).toEqual({});
  });
});

describe("markCourseCompleted", () => {
  it("promotes only from ACTIVE", async () => {
    // The previous updateMany matched on (userId, courseId) alone, so a SUSPENDED
    // learner who still had progress rows could be flipped to COMPLETED and become
    // eligible for a Certificate.
    dbMock.enrollment.updateMany.mockResolvedValue({ count: 1 });

    await markCourseCompleted("user_1", "course_1");

    expect(dbMock.enrollment.updateMany).toHaveBeenCalledWith({
      // The source statuses come from the transition table (#50): only ACTIVE.
      where: { userId: "user_1", courseId: "course_1", status: { in: ["ACTIVE"] } },
      data: { status: "COMPLETED" },
    });
  });

  it("reports whether a row changed", async () => {
    dbMock.enrollment.updateMany.mockResolvedValue({ count: 1 });
    await expect(markCourseCompleted("user_1", "course_1")).resolves.toBe(true);

    dbMock.enrollment.updateMany.mockResolvedValue({ count: 0 });
    await expect(markCourseCompleted("user_1", "course_1")).resolves.toBe(false);
  });

  it("joins a caller's transaction when given one", async () => {
    const tx = { enrollment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    await markCourseCompleted("user_1", "course_1", tx as never);

    expect(tx.enrollment.updateMany).toHaveBeenCalled();
    expect(dbMock.enrollment.updateMany).not.toHaveBeenCalled();
  });
});
