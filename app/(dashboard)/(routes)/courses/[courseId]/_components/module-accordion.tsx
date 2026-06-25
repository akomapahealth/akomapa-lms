"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle, Circle, Lock, Layers } from "lucide-react";
import Link from "next/link";
import { type ModuleDetail } from "@/actions/get-course-detail";

interface ModuleAccordionProps {
  modules: ModuleDetail[];
  courseId: string;
  isPurchased: boolean;
}

export const ModuleAccordion = ({
  modules,
  courseId,
  isPurchased,
}: ModuleAccordionProps) => {
  return (
    <Accordion type="multiple" className="w-full">
      {modules.map((mod) => (
        <AccordionItem key={mod.id} value={mod.id}>
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-3 text-left">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-akomapa-ice shrink-0">
                <Layers className="h-4 w-4 text-akomapa-teal" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {mod.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mod.completedTopics}/{mod.totalTopics} topics
                  {mod.percentage > 0 && (
                    <span className="ml-2 text-success">
                      {mod.percentage}%
                    </span>
                  )}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pl-4 pr-2 space-y-1">
              {mod.topics.map((topic) => {
                const isLocked = !topic.isFree && !isPurchased;
                const Icon = topic.isCompleted
                  ? CheckCircle
                  : isLocked
                    ? Lock
                    : Circle;
                const iconColor = topic.isCompleted
                  ? "text-success"
                  : isLocked
                    ? "text-muted-foreground/70"
                    : "text-muted-foreground";

                return (
                  <Link
                    key={topic.id}
                    href={
                      isLocked
                        ? "#"
                        : `/courses/${courseId}/chapters/${topic.id}`
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isLocked
                        ? "text-muted-foreground/70 cursor-not-allowed"
                        : "text-foreground hover:bg-akomapa-ice/50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                    <span className="truncate">{topic.title}</span>
                  </Link>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
