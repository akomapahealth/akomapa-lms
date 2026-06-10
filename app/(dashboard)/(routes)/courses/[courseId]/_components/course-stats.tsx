import { Layers, BookOpen, FileQuestion } from "lucide-react";
import { IconBadge } from "@/components/icon-badge";

interface CourseStatsProps {
  totalModules: number;
  totalTopics: number;
  totalQuizzes: number;
}

export const CourseStats = ({
  totalModules,
  totalTopics,
  totalQuizzes,
}: CourseStatsProps) => {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
      <div className="flex items-center gap-1.5">
        <IconBadge size="sm" icon={Layers} />
        <span>{totalModules} Modules</span>
      </div>
      <div className="flex items-center gap-1.5">
        <IconBadge size="sm" icon={BookOpen} />
        <span>{totalTopics} Topics</span>
      </div>
      {totalQuizzes > 0 && (
        <div className="flex items-center gap-1.5">
          <IconBadge size="sm" icon={FileQuestion} />
          <span>{totalQuizzes} Quizzes</span>
        </div>
      )}
    </div>
  );
};
