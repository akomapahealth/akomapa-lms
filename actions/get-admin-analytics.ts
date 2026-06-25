import { db } from "@/lib/db";

export interface EffectivenessData {
  courseTitle: string;
  preTestAvg: number;
  postTestAvg: number;
}

export interface EnrollmentTrend {
  month: string;
  count: number;
}

export interface ModuleDropoff {
  moduleTitle: string;
  completionRate: number;
}

export interface BadgeDistribution {
  name: string;
  count: number;
}

export interface EngagementStats {
  totalPosts: number;
  totalComments: number;
  activeUsers: number;
}

export interface StudentActivity {
  date: string;
  topicsCompleted: number;
  quizzesTaken: number;
}

export interface AdminAnalyticsData {
  effectiveness: EffectivenessData[];
  enrollmentTrends: EnrollmentTrend[];
  moduleDropoff: ModuleDropoff[];
  badgeDistribution: BadgeDistribution[];
  engagement: EngagementStats;
  studentActivity: StudentActivity[];
}

export const getAdminAnalytics = async (): Promise<AdminAnalyticsData> => {
  try {
    // 1. Program Effectiveness: pre/post test averages per course
    const courses = await db.course.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        quizzes: {
          where: { isPublished: true },
          select: {
            type: true,
            attempts: {
              where: { completedAt: { not: null } },
              select: { score: true, totalPoints: true },
            },
          },
        },
      },
    });

    const effectiveness: EffectivenessData[] = courses
      .map((course) => {
        const preTests = course.quizzes.filter((q) => q.type === "PRE_TEST");
        const postTests = course.quizzes.filter((q) => q.type === "POST_TEST");

        const preAttempts = preTests.flatMap((q) => q.attempts);
        const postAttempts = postTests.flatMap((q) => q.attempts);

        const preTestAvg =
          preAttempts.length > 0
            ? Math.round(
                (preAttempts.reduce(
                  (sum, a) =>
                    sum + ((a.score ?? 0) / (a.totalPoints ?? 1)) * 100,
                  0
                ) /
                  preAttempts.length)
              )
            : 0;

        const postTestAvg =
          postAttempts.length > 0
            ? Math.round(
                (postAttempts.reduce(
                  (sum, a) =>
                    sum + ((a.score ?? 0) / (a.totalPoints ?? 1)) * 100,
                  0
                ) /
                  postAttempts.length)
              )
            : 0;

        return {
          courseTitle:
            course.title.length > 30
              ? course.title.substring(0, 27) + "..."
              : course.title,
          preTestAvg,
          postTestAvg,
        };
      })
      .filter((e) => e.preTestAvg > 0 || e.postTestAvg > 0);

    // 2. Enrollment Trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const enrollments = await db.enrollment.findMany({
      where: { enrolledAt: { gte: sixMonthsAgo } },
      select: { enrolledAt: true },
    });

    const monthCounts: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthCounts[key] = 0;
    }

    for (const e of enrollments) {
      const key = e.enrolledAt.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      if (key in monthCounts) {
        monthCounts[key]++;
      }
    }

    const enrollmentTrends: EnrollmentTrend[] = Object.entries(monthCounts).map(
      ([month, count]) => ({ month, count })
    );

    // 3. Module Drop-off (completion rate per module for first published course)
    const firstCourse = courses[0];
    let moduleDropoff: ModuleDropoff[] = [];

    if (firstCourse) {
      const modules = await db.module.findMany({
        where: { courseId: firstCourse.id, isPublished: true },
        orderBy: { position: "asc" },
        select: {
          title: true,
          topics: {
            where: { isPublished: true },
            select: {
              _count: { select: { userProgress: { where: { isCompleted: true } } } },
              userProgress: { select: { userId: true } },
            },
          },
        },
      });

      moduleDropoff = modules.map((mod) => {
        const uniqueUsers = new Set(
          mod.topics.flatMap((t) => t.userProgress.map((p) => p.userId))
        );
        const totalUsers = uniqueUsers.size || 1;

        const completedAll = mod.topics.length > 0
          ? mod.topics.reduce(
              (min, t) => Math.min(min, t._count.userProgress),
              Infinity
            )
          : 0;

        return {
          moduleTitle:
            mod.title.length > 25
              ? mod.title.substring(0, 22) + "..."
              : mod.title,
          completionRate: Math.round(
            ((completedAll === Infinity ? 0 : completedAll) / totalUsers) * 100
          ),
        };
      });
    }

    // 4. Badge Distribution
    const badgeCounts = await db.userBadge.groupBy({
      by: ["badgeId"],
      _count: { id: true },
    });

    const badges = await db.badge.findMany({
      select: { id: true, name: true },
    });

    const badgeMap = new Map(badges.map((b) => [b.id, b.name]));
    const badgeDistribution: BadgeDistribution[] = badgeCounts
      .map((bc) => ({
        name: badgeMap.get(bc.badgeId) ?? "Unknown",
        count: bc._count.id,
      }))
      .sort((a, b) => b.count - a.count);

    // 5. Engagement Stats
    const [totalPosts, totalComments, activeUserIds] = await Promise.all([
      db.forumPost.count(),
      db.forumComment.count(),
      db.forumPost
        .findMany({ select: { userId: true }, distinct: ["userId"] })
        .then((users) => users.length),
    ]);

    const engagement: EngagementStats = {
      totalPosts,
      totalComments,
      activeUsers: activeUserIds,
    };

    // 6. Student Activity (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentProgress = await db.userProgress.findMany({
      where: { isCompleted: true, updatedAt: { gte: fourteenDaysAgo } },
      select: { updatedAt: true },
    });

    const recentAttempts = await db.quizAttempt.findMany({
      where: { completedAt: { gte: fourteenDaysAgo, not: null } },
      select: { completedAt: true },
    });

    const activityMap: Record<string, { topics: number; quizzes: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      activityMap[d.toISOString().split("T")[0]] = {
        topics: 0,
        quizzes: 0,
      };
    }

    for (const p of recentProgress) {
      const key = p.updatedAt.toISOString().split("T")[0];
      if (activityMap[key]) activityMap[key].topics++;
    }

    for (const a of recentAttempts) {
      if (!a.completedAt) continue;
      const key = a.completedAt.toISOString().split("T")[0];
      if (activityMap[key]) activityMap[key].quizzes++;
    }

    const studentActivity: StudentActivity[] = Object.entries(activityMap).map(
      ([date, data]) => ({
        date: new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        topicsCompleted: data.topics,
        quizzesTaken: data.quizzes,
      })
    );

    return {
      effectiveness,
      enrollmentTrends,
      moduleDropoff,
      badgeDistribution,
      engagement,
      studentActivity,
    };
  } catch (error) {
    console.log("[GET_ADMIN_ANALYTICS]", error);
    return {
      effectiveness: [],
      enrollmentTrends: [],
      moduleDropoff: [],
      badgeDistribution: [],
      engagement: { totalPosts: 0, totalComments: 0, activeUsers: 0 },
      studentActivity: [],
    };
  }
};
