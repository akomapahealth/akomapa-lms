import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getEnrolledCourses } from "@/actions/get-enrolled-courses";
import { getEnrolledModules } from "@/actions/get-enrolled-modules";
import { CourseFilter } from "./_components/course-filter";
import { EnrolledCourseCard } from "./_components/enrolled-course-card";
import { EnrolledModuleCard } from "./_components/enrolled-module-card";

const CoursesPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; view?: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const params = await searchParams;
  const filter = (params.status as "all" | "in_progress" | "completed" | "not_started") || "all";
  const search = params.search || undefined;
  const view = params.view || "courses";

  const isModulesView = view === "modules";

  const courses = isModulesView ? [] : await getEnrolledCourses(userId, filter, search);
  const modules = isModulesView ? await getEnrolledModules(userId, filter, search) : [];

  const items = isModulesView ? modules : courses;
  const label = isModulesView ? "Modules" : "Courses";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">
        {label} ({items.length})
      </h1>

      <CourseFilter />

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] border border-dashed border-slate-300 rounded-lg">
          <div className="text-center">
            <p className="text-slate-500 text-lg">No {label.toLowerCase()} found</p>
            <p className="text-slate-400 text-sm mt-1">
              Try adjusting your filters or browse available courses
            </p>
          </div>
        </div>
      ) : isModulesView ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {modules.map((mod) => (
            <EnrolledModuleCard
              key={mod.id}
              id={mod.id}
              title={mod.title}
              imageUrl={mod.imageUrl}
              courseId={mod.courseId}
              courseTitle={mod.courseTitle}
              totalTopics={mod.totalTopics}
              completedTopics={mod.completedTopics}
              progress={mod.progress}
              status={mod.status}
            />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((course) => (
            <EnrolledCourseCard
              key={course.id}
              id={course.id}
              title={course.title}
              imageUrl={course.imageUrl}
              categoryName={course.category?.name ?? null}
              moduleCount={course.moduleCount}
              topicCount={course.topicCount}
              quizCount={course.quizCount}
              progress={course.progress}
              status={course.status}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
