"use client";

import { Question, QuestionOption } from "@prisma/client";
import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Grip, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import { QuestionForm } from "./question-form";

type QuestionWithOptions = Question & { options: QuestionOption[] };

interface QuestionsListProps {
  items: QuestionWithOptions[];
  onReorder: (updateData: { id: string; position: number }[]) => void;
  courseId: string;
  quizId: string;
}

export const QuestionsList = ({
  items,
  onReorder,
  courseId,
  quizId,
}: QuestionsListProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [questions, setQuestions] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setQuestions(items);
  }, [items]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reordered = Array.from(questions);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setQuestions(reordered);

    const startIndex = Math.min(result.source.index, result.destination.index);
    const endIndex = Math.max(result.source.index, result.destination.index);

    const bulkUpdateData = reordered
      .slice(startIndex, endIndex + 1)
      .map((q) => ({
        id: q.id,
        position: reordered.findIndex((item) => item.id === q.id),
      }));

    onReorder(bulkUpdateData);
  };

  if (!isMounted) return null;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="questions">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {questions.map((question, index) => (
              <Draggable
                key={question.id}
                draggableId={question.id}
                index={index}
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...(provided.draggableProps as any)}
                  >
                    {editingId === question.id ? (
                      <QuestionForm
                        question={question}
                        courseId={courseId}
                        quizId={quizId}
                        onClose={() => setEditingId(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-x-2 bg-slate-200 border-slate-200 border text-slate-700 rounded-md mb-4 text-sm">
                        <div
                          className="px-2 py-3 border-r border-r-slate-200 hover:bg-slate-300 rounded-l-md transition"
                          {...provided.dragHandleProps}
                        >
                          <Grip className="h-5 w-5" />
                        </div>
                        <span className="line-clamp-1 flex-1">
                          {index + 1}. {question.text}
                        </span>
                        <div className="ml-auto pr-2 flex items-center gap-x-2">
                          <Badge variant="outline" className="text-xs">
                            {question.options.length} options
                          </Badge>
                          <Badge
                            className={cn(
                              "text-xs",
                              question.options.some((o) => o.isCorrect)
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            )}
                          >
                            {question.options.some((o) => o.isCorrect)
                              ? "Ready"
                              : "Needs answer"}
                          </Badge>
                          <Pencil
                            onClick={() => setEditingId(question.id)}
                            className="w-4 h-4 cursor-pointer hover:opacity-75 transition"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
