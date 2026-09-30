import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const {
  courseEntitlement,
  enrollmentStatusFor,
  entitledCourseIds,
  requireCourseAccess,
  topicEntitlement,
} = await import("@/lib/entitlement/course");

const COURSE = "course_1";
const OWNER = "user_faculty_owner";

const learner = { userId: "user_learner", role: "STUDENT" } as const;
const otherFaculty = { userId: "user_other_faculty", role: "FACULTY" } as const;
const owner = { userId: OWNER, role: "FACULTY" } as const;
const admin = { userId: "user_admin", role: "ADMIN" } as const;

function course(overrides: { isPublished?: boolean; userId?: string } = {}) {
  dbMock.course.findUnique.mockResolvedValue({
    userId: overrides.userId ?? OWNER,
    isPublished: overrides.isPublished ?? true,
  });
}

function enrollment(status: string | null) {
  dbMock.enrollment.findUnique.mockResolvedValue(status === null ? null : { status });
}

function topic(isFree: boolean, exists = true) {
  dbMock.topic.findFirst.mockResolvedValue(exists ? { isFree } : null);
}

beforeEach(() => {
  course();
  enrollment(null);
});

/**
 * The entitlement decision (#48, ADR 0002).
 *
 * `Purchase` appears nowhere in these tests, and one of them asserts that it is
 * never queried. That is the decision: Enrollment is the entitlement, Purchase is
 * evidence of payment.
 */
describe("courseEntitlement", () => {
  it("grants full access on an ACTIVE Enrollment", async () => {
    enrollment("ACTIVE");

    expect(await courseEntitlement(learner, COURSE)).toEqual({
      level: "full",
      reason: "active_enrollment",
      canLearn: true,
      enrollmentStatus: "ACTIVE",
    });
  });

  it("grants full access on a COMPLETED Enrollment", async () => {
    // COMPLETED keeps read access to the Course and its Certificate.
    enrollment("COMPLETED");

    const result = await courseEntitlement(learner, COURSE);
    expect(result.canLearn).toBe(true);
    expect(result.reason).toBe("completed_enrollment");
  });

  it("denies a SUSPENDED Enrollment outright", async () => {
    enrollment("SUSPENDED");

    expect(await courseEntitlement(learner, COURSE)).toEqual({
      level: "none",
      reason: "suspended",
      canLearn: false,
      enrollmentStatus: "SUSPENDED",
    });
  });

  it("gives preview, not denial, when there is no Enrollment", async () => {
    // Free Topics stay readable; the Course itself does not.
    expect(await courseEntitlement(learner, COURSE)).toMatchObject({
      level: "preview",
      reason: "not_enrolled",
      canLearn: false,
    });
  });

  it("never reads Purchase", async () => {
    // The whole point of ADR 0002. A Purchase row survives a suspension and a
    // refund, so reading it here is what let both be ignored.
    enrollment("ACTIVE");
    await courseEntitlement(learner, COURSE);

    expect(dbMock.purchase.findUnique).not.toHaveBeenCalled();
    expect(dbMock.purchase.findMany).not.toHaveBeenCalled();
  });

  it("denies when the Course does not exist", async () => {
    dbMock.course.findUnique.mockResolvedValue(null);

    expect(await courseEntitlement(learner, COURSE)).toMatchObject({
      level: "none",
      reason: "course_not_found",
    });
  });

  it("denies an absent principal without querying anything", async () => {
    // Checked before the query, so an unauthenticated request cannot be used to
    // probe which Course ids exist.
    for (const principal of [null, undefined]) {
      expect(await courseEntitlement(principal, COURSE)).toMatchObject({
        reason: "course_not_found",
        canLearn: false,
      });
    }
    expect(dbMock.course.findUnique).not.toHaveBeenCalled();
  });

  it("treats an unrecognised status as no entitlement at all", async () => {
    // Not as "no enrollment" either: that would silently downgrade a suspension
    // to a preview, which is the more permissive reading.
    enrollment("PAUSED");

    expect(await courseEntitlement(learner, COURSE)).toMatchObject({
      level: "none",
      reason: "course_not_found",
      canLearn: false,
    });
  });

  describe("unpublished Courses", () => {
    it("denies a learner, even an enrolled one", async () => {
      course({ isPublished: false });
      enrollment("ACTIVE");

      expect(await courseEntitlement(learner, COURSE)).toMatchObject({
        level: "none",
        reason: "course_unpublished",
      });
    });

    it("denies free preview too, because a draft is not a preview", async () => {
      course({ isPublished: false });

      const result = await courseEntitlement(learner, COURSE);
      expect(result.level).toBe("none");
    });

    it("still serves the author, who has to read what they are writing", async () => {
      course({ isPublished: false });

      expect(await courseEntitlement(owner, COURSE)).toMatchObject({
        level: "full",
        reason: "staff_access",
      });
    });
  });

  describe("staff", () => {
    it("grants the Course author full access with no Enrollment", async () => {
      expect(await courseEntitlement(owner, COURSE)).toMatchObject({
        level: "full",
        reason: "staff_access",
      });
    });

    it("grants an ADMIN full access to any Course", async () => {
      expect(await courseEntitlement(admin, COURSE)).toMatchObject({
        level: "full",
        reason: "staff_access",
      });
    });

    it("does not grant a FACULTY member access to someone else's Course", async () => {
      // Authoring privilege is scoped to what they author.
      expect(await courseEntitlement(otherFaculty, COURSE)).toMatchObject({
        level: "preview",
        reason: "not_enrolled",
      });
    });

    it("denies a SUSPENDED ADMIN: privilege does not buy back a suspension", async () => {
      // docs/permission-matrix.md states this invariant explicitly.
      enrollment("SUSPENDED");

      expect(await courseEntitlement(admin, COURSE)).toMatchObject({
        level: "none",
        reason: "suspended",
      });
    });

    it("denies a SUSPENDED author of their own Course", async () => {
      enrollment("SUSPENDED");

      expect(await courseEntitlement(owner, COURSE)).toMatchObject({
        reason: "suspended",
        canLearn: false,
      });
    });
  });
});

describe("topicEntitlement", () => {
  it("opens a paid Topic to an enrolled learner", async () => {
    enrollment("ACTIVE");
    topic(false);

    const result = await topicEntitlement(learner, COURSE, "topic_1");
    expect(result.canReadTopic).toBe(true);
    expect(result.isFreePreview).toBe(false);
  });

  it("opens a free Topic to someone with no Enrollment", async () => {
    topic(true);

    const result = await topicEntitlement(learner, COURSE, "topic_1");
    expect(result.canReadTopic).toBe(true);
    expect(result.canLearn).toBe(false);
    expect(result.isFreePreview).toBe(true);
  });

  it("keeps a paid Topic shut to someone with no Enrollment", async () => {
    topic(false);

    expect((await topicEntitlement(learner, COURSE, "topic_1")).canReadTopic).toBe(false);
  });

  it("shuts even a free Topic to a suspended learner", async () => {
    // Free preview is an exception to "not enrolled", not to "denied".
    enrollment("SUSPENDED");
    topic(true);

    const result = await topicEntitlement(learner, COURSE, "topic_1");
    expect(result.canReadTopic).toBe(false);
    expect(result.reason).toBe("suspended");
  });

  it("shuts a free Topic in an unpublished Course", async () => {
    course({ isPublished: false });
    topic(true);

    expect((await topicEntitlement(learner, COURSE, "topic_1")).canReadTopic).toBe(false);
  });

  it("refuses a Topic that is not in this Course", async () => {
    // The #39 binding: the query requires the Topic to be reached through a
    // Module of this Course, so an id from elsewhere resolves to nothing.
    enrollment("ACTIVE");
    topic(false, false);

    const result = await topicEntitlement(learner, COURSE, "topic_from_elsewhere");
    expect(result.canReadTopic).toBe(false);
    expect(result.isFreePreview).toBe(false);
  });

  it("only considers published Topics", async () => {
    enrollment("ACTIVE");
    topic(false);

    await topicEntitlement(learner, COURSE, "topic_1");

    expect(dbMock.topic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "topic_1", isPublished: true, module: { courseId: COURSE } },
      })
    );
  });
});

describe("entitledCourseIds", () => {
  it("returns ACTIVE and COMPLETED Courses, and excludes SUSPENDED", async () => {
    dbMock.enrollment.findMany.mockResolvedValue([{ courseId: "a" }, { courseId: "b" }]);

    expect(await entitledCourseIds(learner)).toEqual(["a", "b"]);
    expect(dbMock.enrollment.findMany).toHaveBeenCalledWith({
      where: { userId: learner.userId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { courseId: true },
    });
  });

  it("is empty for an absent principal, without querying", async () => {
    expect(await entitledCourseIds(null)).toEqual([]);
    expect(dbMock.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("does not hand staff the whole catalogue", async () => {
    // Staff entitlement exists so an author can read their own draft, not so the
    // learner dashboard fills up with every Course.
    dbMock.enrollment.findMany.mockResolvedValue([]);

    expect(await entitledCourseIds(admin)).toEqual([]);
    expect(dbMock.course.findMany).not.toHaveBeenCalled();
  });
});

describe("enrollmentStatusFor", () => {
  it("returns the normalized status", async () => {
    enrollment("COMPLETED");

    expect(await enrollmentStatusFor("user_1", COURSE)).toBe("COMPLETED");
  });

  it("returns null when there is no Enrollment", async () => {
    enrollment(null);

    expect(await enrollmentStatusFor("user_1", COURSE)).toBeNull();
  });

  it("returns null for an unrecognised status", async () => {
    enrollment("PAUSED");

    expect(await enrollmentStatusFor("user_1", COURSE)).toBeNull();
  });
});

describe("requireCourseAccess", () => {
  it("returns the entitlement when access is granted", async () => {
    enrollment("ACTIVE");

    expect((await requireCourseAccess(learner, COURSE)).canLearn).toBe(true);
  });

  it.each([
    ["no Enrollment", null],
    ["a suspension", "SUSPENDED"],
  ])("denies with not_found for %s", async (_label, status) => {
    // not_found rather than forbidden, so the endpoint cannot be used to
    // enumerate Courses the caller is not on.
    enrollment(status);

    await expect(requireCourseAccess(learner, COURSE)).rejects.toMatchObject({
      name: "Denied",
      reason: "not_found",
    });
  });
});
