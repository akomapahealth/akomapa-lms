"use client";

import Link from "next/link";
import { Course, Module, Topic, UserProgress } from "@prisma/client";
import { FileQuestion, Lock, CheckCircle2, Circle } from "lucide-react";
import { CourseProgress } from "@/components/course-progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { CourseSidebarModule } from "./course-sidebar-module";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type TopicWithProgress = Topic & {
  userProgress: UserProgress[] | null;
};

type ModuleWithTopics = Module & {
  topics: TopicWithProgress[];
};

export interface SidebarQuiz {
  id: string;
  title: string;
  type: string;
  hasAttempt: boolean;
  passed: boolean;
}

interface CourseSidebarProps {
  course: Course;
  modules: ModuleWithTopics[];
  progressCount: number;
  isPurchased: boolean;
  quizzes?: SidebarQuiz[];
}

export const CourseSidebar = ({
  course,
  modules,
  progressCount,
  isPurchased,
  quizzes = [],
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

  const preTest = quizzes.find((q) => q.type === "PRE_TEST");
  const postTest = quizzes.find((q) => q.type === "POST_TEST");
  const moduleQuizzes = quizzes.filter((q) => q.type === "MODULE_QUIZ");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      <div className="p-6 border-b">
        <h1 className="font-semibold text-foreground">{course.title}</h1>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
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
        {/* Pre-Test Link */}
        {preTest && (
          <div className="px-4 pt-3">
            <Link
              href={`/courses/${course.id}/quiz/${preTest.id}`}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-sm transition hover:bg-muted",
                pathname?.includes(preTest.id)
                  ? "bg-akomapa-teal/10 text-akomapa-teal"
                  : "text-muted-foreground"
              )}
            >
              <FileQuestion className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{preTest.title}</span>
              {preTest.passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-success flex-shrink-0" />
              ) : preTest.hasAttempt ? (
                <Circle className="h-3.5 w-3.5 ml-auto text-warning flex-shrink-0" />
              ) : null}
            </Link>
          </div>
        )}

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

        {/* Post-Test Link */}
        {postTest && (
          <div className="px-4 pb-3">
            <Separator className="mb-3" />
            <Link
              href={`/courses/${course.id}/quiz/${postTest.id}`}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-sm transition hover:bg-muted",
                pathname?.includes(postTest.id)
                  ? "bg-akomapa-teal/10 text-akomapa-teal"
                  : "text-muted-foreground"
              )}
            >
              <FileQuestion className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{postTest.title}</span>
              {postTest.passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-success flex-shrink-0" />
              ) : (
                <Lock className="h-3.5 w-3.5 ml-auto text-muted-foreground/60 flex-shrink-0" />
              )}
            </Link>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
