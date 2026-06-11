import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, PlayCircle } from "lucide-react";

import { getCourseDetail } from "@/actions/get-course-detail";
import { Breadcrumb } from "@/components/breadcrumb";
import { StatusBadge } from "@/components/status-badge";
import { CourseProgress } from "@/components/course-progress";
import { Preview } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { CourseStats } from "./_components/course-stats";
import { ModuleAccordion } from "./_components/module-accordion";

const CourseDetailPage = async ({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) => {
  const { courseId } = await params;
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const course = await getCourseDetail(userId, courseId);
  if (!course) return redirect("/courses");

  const status =
    course.percentComplete === 100
      ? "COMPLETED"
      : course.percentComplete > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED";

  return (
    <div className="px-4 py-6 sm:p-6 max-w-4xl mx-auto space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Courses", href: "/courses" },
          { label: course.title },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative w-full md:w-64 aspect-video rounded-lg overflow-hidden shrink-0">
          {course.imageUrl ? (
            <Image
              fill
              className="object-cover"
              alt={course.title}
              src={course.imageUrl}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-akomapa-ice to-akomapa-light-blue flex items-center justify-center">
              <BookOpen className="h-12 w-12 text-akomapa-teal/50" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              {course.categoryName && (
                <p className="text-sm text-akomapa-teal font-medium mb-1">
                  {course.categoryName}
                </p>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {course.title}
              </h1>
            </div>
            <StatusBadge status={status} />
          </div>

          <CourseStats
            totalModules={course.totalModules}
            totalTopics={course.totalTopics}
            totalQuizzes={course.totalQuizzes}
          />

          {course.isPurchased && course.percentComplete > 0 && (
            <CourseProgress
              value={course.percentComplete}
              variant={course.percentComplete === 100 ? "success" : "default"}
            />
          )}

          {course.resumeTopicId && course.isPurchased && (
            <Link
              href={`/courses/${courseId}/chapters/${course.resumeTopicId}`}
            >
              <Button className="bg-akomapa-teal hover:bg-akomapa-teal-dark text-white mt-2">
                <PlayCircle className="h-4 w-4 mr-2" />
                {course.percentComplete > 0 ? "Resume Course" : "Start Course"}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Description */}
      {course.description && (
        <div>
          <Preview value={course.description} />
        </div>
      )}

      {/* Modules */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Modules ({course.totalModules})
        </h2>
        <div className="border rounded-lg">
          <ModuleAccordion
            modules={course.modules}
            courseId={courseId}
            isPurchased={course.isPurchased}
          />
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
