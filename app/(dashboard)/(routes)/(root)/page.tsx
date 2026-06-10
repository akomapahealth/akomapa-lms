import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getEnrolledCourses } from "@/actions/get-enrolled-courses";
import { getCourseProgressBreakdown } from "@/actions/get-course-progress-breakdown";
import { getQuizProgress } from "@/actions/get-quiz-progress";
import { getCompletionTimeline } from "@/actions/get-completion-timeline";

import { WelcomeBanner } from "./_components/welcome-banner";
import { CourseSelector } from "./_components/course-selector";
import { ProgressDonutChart } from "./_components/progress-donut-chart";
import { TopicProgressSection } from "./_components/topic-progress-section";
import { QuizProgressSection } from "./_components/quiz-progress-section";
import { TimeProgressChart } from "./_components/time-progress-chart";

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

  // Fetch enrolled courses
  const enrolledCourses = await getEnrolledCourses(userId);

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
    <div className="p-6 space-y-6">
      <WelcomeBanner
        inProgressCount={inProgressCount}
        completedCount={completedCount}
      />

      <CourseSelector
        courses={courseOptions}
        selectedCourseId={courseId}
      />

      {enrolledCourses.length === 0 ? (
        <div className="text-center py-10 text-slate-500">
          <p className="text-lg font-medium">No courses yet</p>
          <p className="text-sm mt-1">
            Browse available courses to get started
          </p>
        </div>
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
