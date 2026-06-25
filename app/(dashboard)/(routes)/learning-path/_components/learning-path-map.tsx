"use client";

import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle, Lock } from "lucide-react";
import { motion } from "framer-motion";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type LearningPathCourse } from "@/actions/get-learning-path";

interface LearningPathMapProps {
  courses: LearningPathCourse[];
}

export const LearningPathMap = ({ courses }: LearningPathMapProps) => {
  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-muted hidden md:block" />

      <div className="space-y-6">
        {courses.map((course, index) => {
          const progressPercent =
            course.totalTopics > 0
              ? Math.round(
                  (course.completedTopics / course.totalTopics) * 100
                )
              : 0;

          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Link
                href={
                  course.isEnrolled
                    ? `/courses/${course.id}`
                    : `/courses/${course.id}`
                }
                className="block"
              >
                <div className="flex items-start gap-4 md:gap-6 group">
                  {/* Node */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center border-2 transition",
                        course.status === "COMPLETED"
                          ? "bg-success/10 border-success"
                          : course.status === "IN_PROGRESS"
                            ? "bg-akomapa-teal/10 border-akomapa-teal"
                            : course.isEnrolled
                              ? "bg-muted/50 border-border"
                              : "bg-muted/50 border-border"
                      )}
                    >
                      {course.status === "COMPLETED" ? (
                        <CheckCircle2 className="h-7 w-7 text-success" />
                      ) : course.status === "IN_PROGRESS" ? (
                        <PlayCircle className="h-7 w-7 text-akomapa-teal" />
                      ) : course.isEnrolled ? (
                        <Circle className="h-7 w-7 text-muted-foreground/70" />
                      ) : (
                        <Lock className="h-6 w-6 text-muted-foreground/50" />
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 bg-card text-xs font-bold text-muted-foreground rounded-full w-6 h-6 flex items-center justify-center border">
                      {index + 1}
                    </span>
                  </div>

                  {/* Card */}
                  <div
                    className={cn(
                      "flex-1 p-4 rounded-lg border transition group-hover:shadow-md",
                      course.status === "COMPLETED"
                        ? "border-success/30 bg-success/10/50"
                        : course.status === "IN_PROGRESS"
                          ? "border-akomapa-teal/30 bg-card"
                          : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-akomapa-teal transition">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {course.description}
                          </p>
                        )}
                      </div>
                      {course.status === "COMPLETED" && (
                        <span className="text-xs font-medium text-success bg-success/15 px-2 py-1 rounded-full whitespace-nowrap">
                          Completed
                        </span>
                      )}
                      {course.status === "IN_PROGRESS" && (
                        <span className="text-xs font-medium text-akomapa-teal bg-akomapa-teal/10 px-2 py-1 rounded-full whitespace-nowrap">
                          In Progress
                        </span>
                      )}
                    </div>

                    {course.isEnrolled && course.totalTopics > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={progressPercent} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {course.completedTopics}/{course.totalTopics} topics
                        </span>
                      </div>
                    )}

                    {!course.isEnrolled && (
                      <p className="mt-2 text-xs text-muted-foreground/70">
                        Not enrolled yet
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
