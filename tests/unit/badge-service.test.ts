import { beforeEach, describe, expect, it, vi } from "vitest";

import { aBadgeWithCriteria } from "./support/builders";
import { dbMock } from "./support/db";

vi.mock("@/lib/db", async () => ({
  db: (await import("./support/db")).dbMock,
}));

const { evaluateBadges } = await import("@/lib/badge-service");
type BadgeEvent = Parameters<typeof evaluateBadges>[1];

/**
 * Badges are cheap to award and expensive to retract: a learner who sees a
 * badge appear and disappear loses trust in every other number on the page.
 * The rules that matter are therefore "award exactly once" and "award only on
 * the matching event", and both are covered below alongside the thresholds.
 *
 * Related work: #83 makes awarding idempotent and event-driven.
 */
beforeEach(() => {
  dbMock.userBadge.createMany.mockResolvedValue({ count: 1 });
});

/** Offers a single unearned badge and reports whether the event earned it. */
async function earns(
  criteria: Record<string, unknown>,
  event: BadgeEvent
): Promise<boolean> {
  dbMock.badge.findMany.mockResolvedValue([aBadgeWithCriteria(criteria)]);
  const awarded = await evaluateBadges("user_1", event);
  return awarded.length === 1;
}

describe("evaluateBadges", () => {
  it("awards nothing when no badges are defined", async () => {
    dbMock.badge.findMany.mockResolvedValue([]);

    await expect(evaluateBadges("user_1", { type: "post_created", postId: "p1" }))
      .resolves.toEqual([]);
    expect(dbMock.userBadge.createMany).not.toHaveBeenCalled();
  });

  it("never re-awards a badge the learner already holds", async () => {
    const badge = aBadgeWithCriteria({ type: "topics_completed", count: 1 });
    dbMock.badge.findMany.mockResolvedValue([badge]);
    dbMock.userBadge.findMany.mockResolvedValue([{ badgeId: badge.id }]);
    dbMock.userProgress.count.mockResolvedValue(999);

    await expect(
      evaluateBadges("user_1", { type: "topic_completed", topicId: "t1" })
    ).resolves.toEqual([]);
    expect(dbMock.userBadge.createMany).not.toHaveBeenCalled();
  });

  it("persists newly earned badges with skipDuplicates so a concurrent award cannot fail the request", async () => {
    dbMock.userProgress.count.mockResolvedValue(5);
    dbMock.badge.findMany.mockResolvedValue([
      aBadgeWithCriteria({ type: "topics_completed", count: 1 }, { id: "badge_a" }),
      aBadgeWithCriteria({ type: "topics_completed", count: 5 }, { id: "badge_b" }),
    ]);

    const awarded = await evaluateBadges("user_1", {
      type: "topic_completed",
      topicId: "t1",
    });

    expect(awarded.map((b) => b.id)).toEqual(["badge_a", "badge_b"]);
    expect(dbMock.userBadge.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user_1", badgeId: "badge_a" },
        { userId: "user_1", badgeId: "badge_b" },
      ],
      skipDuplicates: true,
    });
  });

  it("ignores criteria types it does not recognise", async () => {
    expect(
      await earns({ type: "logged_in_on_a_tuesday", count: 1 }, {
        type: "post_created",
        postId: "p1",
      })
    ).toBe(false);
  });
});

describe("criteria are bound to their triggering event", () => {
  /**
   * Every rule checks the event type first. Without that guard, completing a
   * Topic could award a community badge whose counter happened to be high
   * enough, which is how badge systems start awarding things at random.
   */
  const mismatches: Array<[string, Record<string, unknown>, BadgeEvent]> = [
    ["topics_completed", { type: "topics_completed", count: 1 }, { type: "post_created", postId: "p1" }],
    ["modules_completed", { type: "modules_completed", count: 1 }, { type: "topic_completed", topicId: "t1" }],
    ["courses_completed", { type: "courses_completed", count: 1 }, { type: "module_completed", moduleId: "m1" }],
    ["quiz_score", { type: "quiz_score", score: 50 }, { type: "topic_completed", topicId: "t1" }],
    ["streak_days", { type: "streak_days", count: 1 }, { type: "topic_completed", topicId: "t1" }],
    ["posts_created", { type: "posts_created", count: 1 }, { type: "comment_created", commentId: "c1" }],
    ["comments_created", { type: "comments_created", count: 1 }, { type: "post_created", postId: "p1" }],
  ];

  for (const [name, criteria, wrongEvent] of mismatches) {
    it(`does not award ${name} on a ${wrongEvent.type} event`, async () => {
      dbMock.userProgress.count.mockResolvedValue(999);
      dbMock.forumPost.count.mockResolvedValue(999);
      dbMock.forumComment.count.mockResolvedValue(999);
      dbMock.enrollment.count.mockResolvedValue(999);

      expect(await earns(criteria, wrongEvent)).toBe(false);
    });
  }
});

describe("counting thresholds", () => {
  const event: BadgeEvent = { type: "topic_completed", topicId: "t1" };

  it("awards at the threshold and above, but not below", async () => {
    for (const [completed, expected] of [
      [4, false],
      [5, true],
      [6, true],
    ] as const) {
      dbMock.userProgress.count.mockResolvedValue(completed);
      expect(await earns({ type: "topics_completed", count: 5 }, event)).toBe(expected);
    }
  });

  it("falls back to a threshold of 1 when the criteria omit a count", async () => {
    dbMock.userProgress.count.mockResolvedValue(1);
    expect(await earns({ type: "topics_completed" }, event)).toBe(true);

    dbMock.userProgress.count.mockResolvedValue(0);
    expect(await earns({ type: "topics_completed" }, event)).toBe(false);
  });

  it("counts only completed progress rows for the requesting learner", async () => {
    dbMock.userProgress.count.mockResolvedValue(1);
    await earns({ type: "topics_completed", count: 1 }, event);

    expect(dbMock.userProgress.count).toHaveBeenCalledWith({
      where: { userId: "user_1", isCompleted: true },
    });
  });

  it("counts completed Courses from Enrollment, the canonical entitlement", async () => {
    dbMock.enrollment.count.mockResolvedValue(3);
    expect(
      await earns({ type: "courses_completed", count: 3 }, {
        type: "course_completed",
        courseId: "course_1",
      })
    ).toBe(true);
    expect(dbMock.enrollment.count).toHaveBeenCalledWith({
      where: { userId: "user_1", status: "COMPLETED" },
    });
  });
});

describe("quiz score criteria", () => {
  const attempt = (score: number, preTestScore?: number): BadgeEvent => ({
    type: "quiz_completed",
    quizId: "quiz_1",
    score,
    preTestScore,
  });

  it("awards at the exact passing score and above", async () => {
    for (const [score, expected] of [
      [79, false],
      [80, true],
      [100, true],
    ] as const) {
      expect(await earns({ type: "quiz_score", score: 80 }, attempt(score))).toBe(expected);
    }
  });

  it("demands a perfect score when the criteria omit one", async () => {
    expect(await earns({ type: "quiz_score" }, attempt(99))).toBe(false);
    expect(await earns({ type: "quiz_score" }, attempt(100))).toBe(true);
  });

  it("awards improvement only when a pre-test score exists", async () => {
    // A missing pre-test must not be read as a zero, which would turn any
    // post-test result into a large improvement.
    expect(
      await earns({ type: "score_improvement", minImprovement: 20 }, attempt(90))
    ).toBe(false);
    expect(
      await earns({ type: "score_improvement", minImprovement: 20 }, attempt(90, 70))
    ).toBe(true);
  });

  it("measures improvement at the threshold, and ignores a decline", async () => {
    for (const [pre, post, expected] of [
      [70, 89, false],
      [70, 90, true],
      [90, 70, false],
      [70, 70, false],
    ] as const) {
      expect(
        await earns({ type: "score_improvement", minImprovement: 20 }, attempt(post, pre))
      ).toBe(expected);
    }
  });
});

describe("streak criteria", () => {
  it("awards at the streak threshold and above", async () => {
    for (const [days, expected] of [
      [6, false],
      [7, true],
      [8, true],
    ] as const) {
      expect(
        await earns({ type: "streak_days", count: 7 }, {
          type: "streak_updated",
          currentStreak: days,
        })
      ).toBe(expected);
    }
  });

  it("defaults to a seven-day streak when the criteria omit a count", async () => {
    expect(
      await earns({ type: "streak_days" }, { type: "streak_updated", currentStreak: 7 })
    ).toBe(true);
    expect(
      await earns({ type: "streak_days" }, { type: "streak_updated", currentStreak: 6 })
    ).toBe(false);
  });
});

describe("module and category completion", () => {
  it("requires every published Topic in a Module to be complete", async () => {
    dbMock.module.findMany.mockResolvedValue([
      { id: "module_1", isPublished: true, topics: [{ id: "t1" }, { id: "t2" }] },
    ]);
    dbMock.userProgress.count.mockResolvedValue(1);

    expect(
      await earns({ type: "modules_completed", count: 1 }, {
        type: "module_completed",
        moduleId: "module_1",
      })
    ).toBe(false);

    dbMock.userProgress.count.mockResolvedValue(2);
    expect(
      await earns({ type: "modules_completed", count: 1 }, {
        type: "module_completed",
        moduleId: "module_1",
      })
    ).toBe(true);
  });

  it("does not count an empty Module as completed", async () => {
    // A Module with no published Topics is vacuously "complete" under a naive
    // rule. #59 owns the equivalent rule for Courses.
    dbMock.module.findMany.mockResolvedValue([
      { id: "module_1", isPublished: true, topics: [] },
    ]);

    expect(
      await earns({ type: "modules_completed", count: 1 }, {
        type: "module_completed",
        moduleId: "module_1",
      })
    ).toBe(false);
  });

  it("does not award a category badge when the learner owns no Course in it", async () => {
    dbMock.course.findMany.mockResolvedValue([]);

    expect(
      await earns({ type: "category_completed", category: "Ethics" }, {
        type: "course_completed",
        courseId: "course_1",
      })
    ).toBe(false);
  });

  it("awards the category badge once every Module in it is complete", async () => {
    dbMock.course.findMany.mockResolvedValue([
      {
        id: "course_1",
        modules: [
          { id: "module_1", isPublished: true, topics: [{ id: "t1" }] },
          // An empty Module is skipped rather than blocking the award.
          { id: "module_2", isPublished: true, topics: [] },
        ],
      },
    ]);
    dbMock.userProgress.count.mockResolvedValue(1);

    expect(
      await earns({ type: "category_completed", category: "Ethics" }, {
        type: "module_completed",
        moduleId: "module_1",
      })
    ).toBe(true);
  });

  it("requires every Module of every owned Course in the category", async () => {
    dbMock.course.findMany.mockResolvedValue([
      {
        id: "course_1",
        modules: [
          { id: "module_1", isPublished: true, topics: [{ id: "t1" }] },
          { id: "module_2", isPublished: true, topics: [{ id: "t2" }, { id: "t3" }] },
        ],
      },
    ]);
    dbMock.userProgress.count.mockResolvedValue(1);

    expect(
      await earns({ type: "category_completed", category: "Ethics" }, {
        type: "course_completed",
        courseId: "course_1",
      })
    ).toBe(false);
  });
});

describe("community criteria", () => {
  it("counts a learner's own posts against the threshold", async () => {
    const event: BadgeEvent = { type: "post_created", postId: "p1" };

    for (const [posts, expected] of [
      [4, false],
      [5, true],
    ] as const) {
      dbMock.forumPost.count.mockResolvedValue(posts);
      expect(await earns({ type: "posts_created", count: 5 }, event)).toBe(expected);
    }

    expect(dbMock.forumPost.count).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  });

  it("defaults the post threshold to five", async () => {
    const event: BadgeEvent = { type: "post_created", postId: "p1" };

    dbMock.forumPost.count.mockResolvedValue(5);
    expect(await earns({ type: "posts_created" }, event)).toBe(true);
    dbMock.forumPost.count.mockResolvedValue(4);
    expect(await earns({ type: "posts_created" }, event)).toBe(false);
  });

  it("counts a learner's own comments against the threshold", async () => {
    const event: BadgeEvent = { type: "comment_created", commentId: "c1" };

    for (const [comments, expected] of [
      [9, false],
      [10, true],
    ] as const) {
      dbMock.forumComment.count.mockResolvedValue(comments);
      expect(await earns({ type: "comments_created" }, event)).toBe(expected);
    }

    expect(dbMock.forumComment.count).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  });

  it("counts likes received on the learner's posts, not likes they gave", async () => {
    dbMock.postLike.count.mockResolvedValue(50);

    expect(
      await earns({ type: "post_likes_received" }, { type: "post_created", postId: "p1" })
    ).toBe(true);

    // `post: { userId }` scopes to likes *on* the learner's posts. Scoping to
    // `userId` directly would count likes the learner handed out.
    expect(dbMock.postLike.count).toHaveBeenCalledWith({
      where: { post: { userId: "user_1" } },
    });
  });

  it("awards likes received on either a post or a comment event, and denies below the threshold", async () => {
    dbMock.postLike.count.mockResolvedValue(49);
    expect(
      await earns({ type: "post_likes_received", count: 50 }, { type: "post_created", postId: "p1" })
    ).toBe(false);

    dbMock.postLike.count.mockResolvedValue(50);
    expect(
      await earns({ type: "post_likes_received", count: 50 }, {
        type: "comment_created",
        commentId: "c1",
      })
    ).toBe(true);
  });

  it("does not award likes received on an unrelated event", async () => {
    dbMock.postLike.count.mockResolvedValue(999);
    expect(
      await earns({ type: "post_likes_received" }, { type: "topic_completed", topicId: "t1" })
    ).toBe(false);
  });
});

describe("all_quizzes_passed", () => {
  it("denies when the triggering Quiz belongs to no Course", async () => {
    dbMock.quiz.findUnique.mockResolvedValue({ courseId: null });

    expect(
      await earns({ type: "all_quizzes_passed" }, {
        type: "quiz_completed",
        quizId: "quiz_1",
        score: 100,
      })
    ).toBe(false);
  });

  it("denies when any published Quiz has no completed attempt", async () => {
    dbMock.quiz.findUnique.mockResolvedValue({ courseId: "course_1" });
    dbMock.quiz.findMany.mockResolvedValue([
      { id: "quiz_1", passingScore: 70 },
      { id: "quiz_2", passingScore: 70 },
    ]);
    dbMock.quizAttempt.findFirst
      .mockResolvedValueOnce({ score: 90 })
      .mockResolvedValueOnce(null);

    expect(
      await earns({ type: "all_quizzes_passed" }, {
        type: "quiz_completed",
        quizId: "quiz_1",
        score: 90,
      })
    ).toBe(false);
  });

  it("denies at one point below the passing score and awards at it", async () => {
    dbMock.quiz.findUnique.mockResolvedValue({ courseId: "course_1" });
    dbMock.quiz.findMany.mockResolvedValue([{ id: "quiz_1", passingScore: 70 }]);

    for (const [score, expected] of [
      [69, false],
      [70, true],
    ] as const) {
      dbMock.quizAttempt.findFirst.mockResolvedValue({ score });
      expect(
        await earns({ type: "all_quizzes_passed" }, {
          type: "quiz_completed",
          quizId: "quiz_1",
          score,
        })
      ).toBe(expected);
    }
  });

  it("treats a null score as failing rather than as zero-passing", async () => {
    dbMock.quiz.findUnique.mockResolvedValue({ courseId: "course_1" });
    dbMock.quiz.findMany.mockResolvedValue([{ id: "quiz_1", passingScore: 0 }]);
    dbMock.quizAttempt.findFirst.mockResolvedValue({ score: null });

    // passingScore 0 makes `0 >= 0` true, so this documents that a graded-null
    // attempt still satisfies a zero threshold; any non-zero threshold denies.
    expect(
      await earns({ type: "all_quizzes_passed" }, {
        type: "quiz_completed",
        quizId: "quiz_1",
        score: 0,
      })
    ).toBe(true);
  });
});
