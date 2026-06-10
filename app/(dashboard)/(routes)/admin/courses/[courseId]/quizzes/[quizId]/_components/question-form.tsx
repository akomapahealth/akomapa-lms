"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { Question, QuestionOption } from "@prisma/client";
import { PlusCircle, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface QuestionFormProps {
  question: Question & { options: QuestionOption[] };
  courseId: string;
  quizId: string;
  onClose: () => void;
}

interface OptionState {
  id?: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export const QuestionForm = ({
  question,
  courseId,
  quizId,
  onClose,
}: QuestionFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState(question.text);
  const [points, setPoints] = useState(question.points);
  const [options, setOptions] = useState<OptionState[]>(
    question.options.map((o) => ({
      id: o.id,
      text: o.text,
      isCorrect: o.isCorrect,
      position: o.position,
    }))
  );

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      { text: "", isCorrect: false, position: prev.length },
    ]);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, position: i })));
  };

  const updateOptionText = (index: number, value: string) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, text: value } : o))
    );
  };

  const setCorrectOption = (index: number) => {
    setOptions((prev) =>
      prev.map((o, i) => ({ ...o, isCorrect: i === index }))
    );
  };

  const onSave = async () => {
    if (!text.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (options.length < 2) {
      toast.error("At least 2 options are required");
      return;
    }

    if (!options.some((o) => o.isCorrect)) {
      toast.error("Please mark a correct answer");
      return;
    }

    if (options.some((o) => !o.text.trim())) {
      toast.error("All options must have text");
      return;
    }

    try {
      setIsLoading(true);
      await axios.patch(
        `/api/courses/${courseId}/quizzes/${quizId}/questions/${question.id}`,
        { text, points, options }
      );
      toast.success("Question updated!");
      onClose();
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setIsLoading(true);
      await axios.delete(
        `/api/courses/${courseId}/quizzes/${quizId}/questions/${question.id}`
      );
      toast.success("Question deleted!");
      onClose();
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Edit Question</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-500">Question Text</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          placeholder="Enter question text..."
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-500">Points</Label>
        <Input
          type="number"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          disabled={isLoading}
          className="w-20"
          min={1}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-500">Options</Label>
        {options.map((option, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectOption(idx)}
              className={cn(
                "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition",
                option.isCorrect
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-slate-300 hover:border-slate-400"
              )}
            >
              {option.isCorrect && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </button>
            <Input
              value={option.text}
              onChange={(e) => updateOptionText(idx, e.target.value)}
              disabled={isLoading}
              placeholder={`Option ${String.fromCharCode(65 + idx)}`}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeOption(idx)}
              disabled={isLoading || options.length <= 2}
              className="text-slate-400 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={isLoading}
          className="mt-2"
        >
          <PlusCircle className="h-3 w-3 mr-1" />
          Add Option
        </Button>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={onSave} disabled={isLoading} size="sm">
          Save
        </Button>
        <Button variant="outline" onClick={onClose} disabled={isLoading} size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
};
