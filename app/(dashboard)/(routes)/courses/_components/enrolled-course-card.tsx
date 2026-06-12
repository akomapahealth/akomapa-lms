import Link from "next/link";
import Image from "next/image";
import { BookOpen, Layers, FileQuestion } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { CourseProgress } from "@/components/course-progress";
import { IconBadge } from "@/components/icon-badge";
import { type CourseStatus } from "@/actions/get-enrolled-courses";

interface EnrolledCourseCardProps {
  id: string;
  title: string;
  imageUrl: string | null;
  categoryName: string | null;
  moduleCount: number;
  topicCount: number;
  quizCount: number;
  progress: number;
  status: CourseStatus;
}

export const EnrolledCourseCard = ({
  id,
  title,
  imageUrl,
  categoryName,
  moduleCount,
  topicCount,
  quizCount,
  progress,
  status,
}: EnrolledCourseCardProps) => {
  return (
    <Link href={`/courses/${id}`}>
      <div className="group hover:shadow-md transition overflow-hidden border border-akomapa-light-blue/30 rounded-lg p-3 h-full">
        <div className="relative w-full aspect-video rounded-md overflow-hidden">
          {imageUrl ? (
            <Image
              fill
              className="object-cover"
              alt={title}
              src={imageUrl}
            />
          ) : (
            <div className="h-full w-full bg-akomapa-ice flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-akomapa-teal/50" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="flex flex-col pt-2">
          {categoryName && (
            <p className="text-xs text-akomapa-teal font-medium mb-1">
              {categoryName}
            </p>
          )}
          <p className="text-base font-semibold text-foreground group-hover:text-akomapa-teal transition line-clamp-2">
            {title}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              <span>{moduleCount} Modules</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{topicCount} Topics</span>
            </div>
            {quizCount > 0 && (
              <div className="flex items-center gap-1">
                <FileQuestion className="h-3.5 w-3.5" />
                <span>{quizCount} Quizzes</span>
              </div>
            )}
          </div>
          {status !== "NOT_STARTED" && (
            <div className="mt-3">
              <CourseProgress
                value={progress}
                variant={progress === 100 ? "success" : "default"}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
