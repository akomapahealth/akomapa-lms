import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getEnrolledCourses } from "@/actions/get-enrolled-courses";
import { getCourseProgressBreakdown } from "@/actions/get-course-progress-breakdown";
import { getQuizProgress } from "@/actions/get-quiz-progress";
import { getCompletionTimeline } from "@/actions/get-completion-timeline";
import { getUserBadges } from "@/actions/get-user-badges";
import { getUserStreak } from "@/actions/get-user-streak";

import { EmptyState } from "@/components/empty-state";
import { BookOpen } from "lucide-react";

import { WelcomeBanner } from "./_components/welcome-banner";
import { CourseSelector } from "./_components/course-selector";
import { ProgressDonutChart } from "./_components/progress-donut-chart";
import { TopicProgressSection } from "./_components/topic-progress-section";
import { QuizProgressSection } from "./_components/quiz-progress-section";
import { TimeProgressChart } from "./_components/time-progress-chart";
import { BadgeGrid } from "./_components/badge-grid";
import { StreakCounter } from "./_components/streak-counter";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; period?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const params = await searchParams;
  const selectedCourseId = params.courseId;
  const period = (params.period === "monthly" ? "monthly" : "weekly") as
    | "weekly"
    | "monthly";

  // Fetch enrolled courses and gamification data
  const [enrolledCourses, badges, streak] = await Promise.all([
    getEnrolledCourses(userId),
    getUserBadges(userId),
    getUserStreak(userId),
  ]);

  const inProgressCount = enrolledCourses.filter(
    (c) => c.status === "IN_PROGRESS"
  ).length;
  const completedCount = enrolledCourses.filter(
    (c) => c.status === "COMPLETED"
  ).length;

  // If a course is selected, fetch its detailed data
  const courseId = selectedCourseId || enrolledCourses[0]?.id;

  const [progressBreakdown, quizProgress, timeline] = courseId
    ? await Promise.all([
        getCourseProgressBreakdown(userId, courseId),
        getQuizProgress(userId, courseId),
        getCompletionTimeline(userId, courseId, period),
      ])
    : [null, [], { dataPoints: [], currentProgress: 0, progressChange: 0, averageProgress: 0, peakProgress: 0 }];

  const courseOptions = enrolledCourses.map((c) => ({
    id: c.id,
    title: c.title,
  }));

  return (
    <div className="px-4 py-6 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <WelcomeBanner
          inProgressCount={inProgressCount}
          completedCount={completedCount}
        />
      </div>

      <div className="flex items-center gap-3">
        <StreakCounter currentStreak={streak.currentStreak} />
      </div>

      <BadgeGrid badges={badges} />

      <CourseSelector
        courses={courseOptions}
        selectedCourseId={courseId}
      />

      {enrolledCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Browse available courses and enroll to start your learning journey."
          actionLabel="Browse Courses"
          actionHref="/search"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ProgressDonutChart
              completed={progressBreakdown?.summary.completed ?? 0}
              inProgress={progressBreakdown?.summary.inProgress ?? 0}
              notStarted={progressBreakdown?.summary.notStarted ?? 0}
              percentComplete={progressBreakdown?.percentComplete ?? 0}
            />
            <TopicProgressSection
              modules={progressBreakdown?.modules ?? []}
            />
            <QuizProgressSection quizzes={quizProgress} courseId={courseId} />
          </div>

          <TimeProgressChart
            dataPoints={timeline.dataPoints}
            currentProgress={timeline.currentProgress}
            progressChange={timeline.progressChange}
            averageProgress={timeline.averageProgress}
            peakProgress={timeline.peakProgress}
            period={period}
          />
        </>
      )}
    </div>
  );
}
