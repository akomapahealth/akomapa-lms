import { db } from "@/lib/db";

export interface CompletionDataPoint {
  label: string;
  completionPercent: number;
}

export interface CompletionTimeline {
  dataPoints: CompletionDataPoint[];
  currentProgress: number;
  progressChange: number;
  averageProgress: number;
  peakProgress: number;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatWeekLabel(date: Date): string {
  return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export const getCompletionTimeline = async (
  userId: string,
  courseId: string,
  period: "weekly" | "monthly" = "weekly"
): Promise<CompletionTimeline> => {
  try {
    // Get total published topics count
    const totalTopics = await db.topic.count({
      where: {
        module: { courseId },
        isPublished: true,
      },
    });

    if (totalTopics === 0) {
      return {
        dataPoints: [],
        currentProgress: 0,
        progressChange: 0,
        averageProgress: 0,
        peakProgress: 0,
      };
    }

    // Get all completed progress records ordered by date
    const topicIds = await db.topic.findMany({
      where: {
        module: { courseId },
        isPublished: true,
      },
      select: { id: true },
    });

    const progressRecords = await db.userProgress.findMany({
      where: {
        userId,
        topicId: { in: topicIds.map((t) => t.id) },
        isCompleted: true,
      },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    });

    if (progressRecords.length === 0) {
      return {
        dataPoints: [],
        currentProgress: 0,
        progressChange: 0,
        averageProgress: 0,
        peakProgress: 0,
      };
    }

    // Group by period
    const getKey =
      period === "weekly"
        ? (d: Date) => getWeekStart(d).toISOString()
        : (d: Date) => getMonthStart(d).toISOString();
    const formatLabel =
      period === "weekly" ? formatWeekLabel : formatMonthLabel;

    const groups = new Map<string, number>();
    for (const record of progressRecords) {
      const key = getKey(record.updatedAt);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    // Build cumulative data points
    let cumulative = 0;
    const dataPoints: CompletionDataPoint[] = [];
    const sortedKeys = [...groups.keys()].sort();

    for (const key of sortedKeys) {
      cumulative += groups.get(key)!;
      const percent = Math.round((cumulative / totalTopics) * 100);
      dataPoints.push({
        label: formatLabel(new Date(key)),
        completionPercent: percent,
      });
    }

    const currentProgress = dataPoints[dataPoints.length - 1]?.completionPercent ?? 0;
    const previousProgress =
      dataPoints.length >= 2
        ? dataPoints[dataPoints.length - 2].completionPercent
        : 0;
    const progressChange = currentProgress - previousProgress;
    const averageProgress =
      dataPoints.length > 0
        ? Math.round(
            dataPoints.reduce((sum, dp) => sum + dp.completionPercent, 0) /
              dataPoints.length
          )
        : 0;
    const peakProgress = Math.max(
      ...dataPoints.map((dp) => dp.completionPercent),
      0
    );

    return {
      dataPoints,
      currentProgress,
      progressChange,
      averageProgress,
      peakProgress,
    };
  } catch (error) {
    console.log("[GET_COMPLETION_TIMELINE]", error);
    return {
      dataPoints: [],
      currentProgress: 0,
      progressChange: 0,
      averageProgress: 0,
      peakProgress: 0,
    };
  }
};
