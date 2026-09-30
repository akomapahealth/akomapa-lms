import { beforeEach, describe, expect, it, vi } from "vitest";

import { testDb } from "./support/db";
import {
  aCourseWithTopic,
  anEnrollmentRow,
  aPaidEnrollment,
  aPurchaseRow,
  aUserRow,
} from "./support/fixtures";

// The module under test resolves `@/lib/db` at import time, so it has to be
// pointed at this worker's database the same way the other integration files do.
vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const { courseEntitlement, entitledCourseIds, topicEntitlement } = await import(
  "@/lib/entitlement/course"
);
const { markCourseCompleted, recordPaidEnrollment } = await import(
  "@/lib/entitlement/enroll"
);

/**
 * Entitlement against a real database (#48, ADR 0002).
 *
 * The unit suite covers the decision table. What needs real rows is the cutover
 * itself: that a Purchase alone grants nothing, that the backfill migration has
 * already given every historical Purchase an Enrollment, and that the paid write
 * is atomic and idempotent.
 */
describe("the Purchase to Enrollment cutover", () => {
  let learner: { id: string };
  let course: Awaited<ReturnType<typeof aCourseWithTopic>>;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    course = await aCourseWithTopic(author.id);
  });

  const principal = () => ({ userId: learner.id, role: "STUDENT" as const });

  it("grants nothing on a Purchase with no Enrollment", async () => {
    // The state the backfill exists to eliminate. Before #48 this was full access.
    await aPurchaseRow(learner.id, course.course.id);

    const entitlement = await courseEntitlement(principal(), course.course.id);

    expect(entitlement.canLearn).toBe(false);
    expect(entitlement.reason).toBe("not_enrolled");
  });

  it("grants access on an Enrollment with no Purchase", async () => {
    // A free Course, a scholarship, or a staff account. Payment is not required
    // for entitlement, only for revenue.
    await anEnrollmentRow(learner.id, course.course.id);

    expect((await courseEntitlement(principal(), course.course.id)).canLearn).toBe(true);
  });

  it("denies a suspended learner who has paid", async () => {
    await aPaidEnrollment(learner.id, course.course.id, "SUSPENDED");

    const entitlement = await courseEntitlement(principal(), course.course.id);

    expect(entitlement.canLearn).toBe(false);
    expect(entitlement.reason).toBe("suspended");
    // The payment evidence is still on file. Access removal is a status change,
    // never a deletion of the Purchase.
    expect(
      await testDb().purchase.count({
        where: { userId: learner.id, courseId: course.course.id },
      })
    ).toBe(1);
  });

  it("excludes a suspended Course from the learner's lists", async () => {
    const active = await aCourseWithTopic((await aUserRow({ role: "FACULTY" })).id);
    await aPaidEnrollment(learner.id, course.course.id, "SUSPENDED");
    await aPaidEnrollment(learner.id, active.course.id, "ACTIVE");

    expect(await entitledCourseIds(principal())).toEqual([active.course.id]);
  });

  it("keeps a completed Course in the learner's lists", async () => {
    // The union of purchases and ACTIVE enrollments used to drop these, so
    // finishing a Course made it disappear.
    await aPaidEnrollment(learner.id, course.course.id, "COMPLETED");

    expect(await entitledCourseIds(principal())).toEqual([course.course.id]);
  });

  it("opens a free Topic without an Enrollment and shuts a paid one", async () => {
    const free = await aCourseWithTopic(
      (await aUserRow({ role: "FACULTY" })).id,
      { topicIsFree: true }
    );

    const freeTopic = await topicEntitlement(principal(), free.course.id, free.topic.id);
    expect(freeTopic.canReadTopic).toBe(true);
    expect(freeTopic.canLearn).toBe(false);

    const paidTopic = await topicEntitlement(principal(), course.course.id, course.topic.id);
    expect(paidTopic.canReadTopic).toBe(false);
  });

  it("refuses a Topic borrowed from another Course", async () => {
    const other = await aCourseWithTopic((await aUserRow({ role: "FACULTY" })).id);
    await aPaidEnrollment(learner.id, course.course.id);

    const result = await topicEntitlement(principal(), course.course.id, other.topic.id);

    expect(result.canReadTopic).toBe(false);
  });
});

describe("recordPaidEnrollment", () => {
  let learner: { id: string };
  let courseId: string;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    courseId = (await aCourseWithTopic(author.id)).course.id;
  });

  it("writes the Purchase and the Enrollment together", async () => {
    await recordPaidEnrollment(learner.id, courseId);

    expect(await testDb().purchase.count({ where: { userId: learner.id, courseId } })).toBe(1);
    const enrollment = await testDb().enrollment.findUnique({
      where: { userId_courseId: { userId: learner.id, courseId } },
    });
    expect(enrollment?.status).toBe("ACTIVE");
  });

  it("is idempotent under redelivery", async () => {
    // A webhook is delivered at least once. Three deliveries, one of each row.
    await recordPaidEnrollment(learner.id, courseId);
    await recordPaidEnrollment(learner.id, courseId);
    await recordPaidEnrollment(learner.id, courseId);

    expect(await testDb().purchase.count({ where: { userId: learner.id, courseId } })).toBe(1);
    expect(await testDb().enrollment.count({ where: { userId: learner.id, courseId } })).toBe(1);
  });

  it("does not reinstate a suspended learner", async () => {
    // The scenario: a learner is suspended, and Stripe redelivers the original
    // checkout event. An upsert that reset the status would silently undo the
    // suspension.
    await anEnrollmentRow(learner.id, courseId, "SUSPENDED");

    await recordPaidEnrollment(learner.id, courseId);

    const enrollment = await testDb().enrollment.findUnique({
      where: { userId_courseId: { userId: learner.id, courseId } },
    });
    expect(enrollment?.status).toBe("SUSPENDED");
  });

  it("does not demote a completed learner back to ACTIVE", async () => {
    await anEnrollmentRow(learner.id, courseId, "COMPLETED");

    await recordPaidEnrollment(learner.id, courseId);

    const enrollment = await testDb().enrollment.findUnique({
      where: { userId_courseId: { userId: learner.id, courseId } },
    });
    expect(enrollment?.status).toBe("COMPLETED");
  });

  it("writes neither row when the transaction fails", async () => {
    // Atomicity, which the unit double cannot show. A Purchase with no Enrollment
    // reads as "paid but locked out", so the pair must not come apart.
    await expect(
      testDb().$transaction(async (tx) => {
        await recordPaidEnrollment(learner.id, courseId, tx);
        throw new Error("something later in the handler failed");
      })
    ).rejects.toThrow("something later in the handler failed");

    expect(await testDb().purchase.count({ where: { userId: learner.id } })).toBe(0);
    expect(await testDb().enrollment.count({ where: { userId: learner.id } })).toBe(0);
  });
});

describe("markCourseCompleted", () => {
  let learner: { id: string };
  let courseId: string;

  beforeEach(async () => {
    learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    courseId = (await aCourseWithTopic(author.id)).course.id;
  });

  const statusOf = async () =>
    (
      await testDb().enrollment.findUnique({
        where: { userId_courseId: { userId: learner.id, courseId } },
      })
    )?.status;

  it("promotes an ACTIVE Enrollment", async () => {
    await anEnrollmentRow(learner.id, courseId, "ACTIVE");

    await expect(markCourseCompleted(learner.id, courseId)).resolves.toBe(true);
    expect(await statusOf()).toBe("COMPLETED");
  });

  it("leaves a SUSPENDED Enrollment alone", async () => {
    // A suspended learner does not complete a Course by finishing its Topics. The
    // previous updateMany matched on (userId, courseId) alone, so they did -- and
    // became eligible for a Certificate.
    await anEnrollmentRow(learner.id, courseId, "SUSPENDED");

    await expect(markCourseCompleted(learner.id, courseId)).resolves.toBe(false);
    expect(await statusOf()).toBe("SUSPENDED");
  });

  it("is a no-op on an already COMPLETED Enrollment", async () => {
    await anEnrollmentRow(learner.id, courseId, "COMPLETED");

    await expect(markCourseCompleted(learner.id, courseId)).resolves.toBe(false);
    expect(await statusOf()).toBe("COMPLETED");
  });
});

describe("the backfill migration", () => {
  it("has already run, so the schema carries no orphaned Purchase", async () => {
    // The migration runs with the deploy and is part of the template this suite
    // clones. This asserts the invariant it establishes rather than re-running it.
    const orphaned = await testDb().$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count
        FROM "Purchase" p
       WHERE NOT EXISTS (
         SELECT 1 FROM "Enrollment" e
          WHERE e."userId" = p."userId" AND e."courseId" = p."courseId")
    `;

    expect(Number(orphaned[0].count)).toBe(0);
  });

  it("would give a historical Purchase an Enrollment dated from the payment", async () => {
    // Re-runs the migration's own statement against a Purchase inserted without
    // one, which is the shape of the production data it was written for.
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const courseId = (await aCourseWithTopic(author.id)).course.id;

    const paidAt = new Date("2026-01-15T09:00:00.000Z");
    await testDb().purchase.create({
      data: { userId: learner.id, courseId, createdAt: paidAt },
    });

    await testDb().$executeRaw`
      INSERT INTO "Enrollment" ("id", "userId", "courseId", "status", "enrolledAt", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), p."userId", p."courseId", 'ACTIVE', p."createdAt", p."createdAt", NOW()
        FROM "Purchase" p
      ON CONFLICT ("userId", "courseId") DO NOTHING
    `;

    const enrollment = await testDb().enrollment.findUnique({
      where: { userId_courseId: { userId: learner.id, courseId } },
    });

    expect(enrollment?.status).toBe("ACTIVE");
    // The date the learner actually gained access, not the migration's clock.
    expect(enrollment?.enrolledAt.toISOString()).toBe(paidAt.toISOString());
  });

  it("is idempotent: a second run changes nothing", async () => {
    const learner = await aUserRow();
    const author = await aUserRow({ role: "FACULTY" });
    const courseId = (await aCourseWithTopic(author.id)).course.id;
    await aPaidEnrollment(learner.id, courseId, "SUSPENDED");

    for (let run = 0; run < 2; run++) {
      await testDb().$executeRaw`
        INSERT INTO "Enrollment" ("id", "userId", "courseId", "status", "enrolledAt", "createdAt", "updatedAt")
        SELECT gen_random_uuid(), p."userId", p."courseId", 'ACTIVE', p."createdAt", p."createdAt", NOW()
          FROM "Purchase" p
        ON CONFLICT ("userId", "courseId") DO NOTHING
      `;
    }

    expect(await testDb().enrollment.count({ where: { userId: learner.id } })).toBe(1);
    // And critically, the existing SUSPENDED status was not reset to ACTIVE.
    const enrollment = await testDb().enrollment.findUnique({
      where: { userId_courseId: { userId: learner.id, courseId } },
    });
    expect(enrollment?.status).toBe("SUSPENDED");
  });
});
