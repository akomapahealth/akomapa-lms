"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CourseSidebarItem } from "./course-sidebar-item";
import { Topic, UserProgress } from "@prisma/client";

type TopicWithProgress = Topic & {
  userProgress: UserProgress[] | null;
};

interface CourseSidebarModuleProps {
  moduleId: string;
  moduleTitle: string;
  topics: TopicWithProgress[];
  courseId: string;
  isPurchased: boolean;
}

export const CourseSidebarModule = ({
  moduleId,
  moduleTitle,
  topics,
  courseId,
  isPurchased,
}: CourseSidebarModuleProps) => {
  const completedCount = topics.filter(
    (t) => t.userProgress?.[0]?.isCompleted
  ).length;

  return (
    <AccordionItem value={moduleId} className="border-b border-border">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 text-sm">
        <div className="flex items-center justify-between w-full mr-2">
          <span className="font-medium text-foreground truncate">
            {moduleTitle}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">
            {completedCount}/{topics.length}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        {topics.map((topic) => (
          <CourseSidebarItem
            key={topic.id}
            id={topic.id}
            label={topic.title}
            isCompleted={!!topic.userProgress?.[0]?.isCompleted}
            courseId={courseId}
            isLocked={!topic.isFree && !isPurchased}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
};
