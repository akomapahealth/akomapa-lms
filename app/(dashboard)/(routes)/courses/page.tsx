import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getEnrolledCourses } from "@/actions/get-enrolled-courses";
import { CourseFilter } from "./_components/course-filter";
import { EnrolledCourseCard } from "./_components/enrolled-course-card";

const CoursesPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const params = await searchParams;
  const filter = (params.status as "all" | "in_progress" | "completed" | "not_started") || "all";
  const search = params.search || undefined;

  const courses = await getEnrolledCourses(userId, filter, search);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">
        Courses ({courses.length})
      </h1>

      <CourseFilter />

      {courses.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] border border-dashed border-slate-300 rounded-lg">
          <div className="text-center">
            <p className="text-slate-500 text-lg">No courses found</p>
            <p className="text-slate-400 text-sm mt-1">
              Try adjusting your filters or browse available courses
            </p>
          </div>
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
