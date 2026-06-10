"use client";

import { Course, Module, Topic, UserProgress } from "@prisma/client";
import { CourseProgress } from "@/components/course-progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion } from "@/components/ui/accordion";
import { CourseSidebarModule } from "./course-sidebar-module";
import { usePathname } from "next/navigation";

type TopicWithProgress = Topic & {
  userProgress: UserProgress[] | null;
};

type ModuleWithTopics = Module & {
  topics: TopicWithProgress[];
};

interface CourseSidebarProps {
  course: Course;
  modules: ModuleWithTopics[];
  progressCount: number;
  isPurchased: boolean;
}

export const CourseSidebar = ({
  course,
  modules,
  progressCount,
  isPurchased,
}: CourseSidebarProps) => {
  const pathname = usePathname();

  // Find which module contains the active topic
  const activeModuleId = modules.find((mod) =>
    mod.topics.some((t) => pathname?.includes(t.id))
  )?.id;

  const totalTopics = modules.reduce((acc, mod) => acc + mod.topics.length, 0);
  const completedTopics = modules.reduce(
    (acc, mod) =>
      acc + mod.topics.filter((t) => t.userProgress?.[0]?.isCompleted).length,
    0
  );

  return (
    <div className="h-full border-r flex flex-col overflow-hidden shadow-sm">
      <div className="p-6 border-b">
        <h1 className="font-semibold text-slate-800">{course.title}</h1>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{modules.length} Modules</span>
          <span>
            {completedTopics}/{totalTopics} Done
          </span>
        </div>
        {isPurchased && (
          <div className="mt-3">
            <CourseProgress variant="success" value={progressCount} />
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        <Accordion
          type="multiple"
          defaultValue={activeModuleId ? [activeModuleId] : []}
        >
          {modules.map((mod) => (
            <CourseSidebarModule
              key={mod.id}
              moduleId={mod.id}
              moduleTitle={mod.title}
              topics={mod.topics}
              courseId={course.id}
              isPurchased={isPurchased}
            />
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
};
