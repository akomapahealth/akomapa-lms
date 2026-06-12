import Link from "next/link";
import Image from "next/image";
import { BookOpen, Layers } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { CourseProgress } from "@/components/course-progress";
import { type ModuleStatus } from "@/actions/get-enrolled-modules";

interface EnrolledModuleCardProps {
  id: string;
  title: string;
  imageUrl: string | null;
  courseId: string;
  courseTitle: string;
  totalTopics: number;
  completedTopics: number;
  progress: number;
  status: ModuleStatus;
}

export const EnrolledModuleCard = ({
  title,
  imageUrl,
  courseId,
  courseTitle,
  totalTopics,
  completedTopics,
  progress,
  status,
}: EnrolledModuleCardProps) => {
  return (
    <Link href={`/courses/${courseId}`}>
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
            <div className="h-full w-full bg-gradient-to-br from-akomapa-ice to-akomapa-light-blue flex items-center justify-center">
              <Layers className="h-10 w-10 text-akomapa-teal/50" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={status} />
          </div>
        </div>
        <div className="flex flex-col pt-2">
          <p className="text-xs text-akomapa-teal font-medium mb-1">
            {courseTitle}
          </p>
          <p className="text-base font-semibold text-foreground group-hover:text-akomapa-teal transition line-clamp-2">
            {title}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span>
                {completedTopics}/{totalTopics} Topics
              </span>
            </div>
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
