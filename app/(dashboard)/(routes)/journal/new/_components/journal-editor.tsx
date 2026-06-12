"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";

import { Editor } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDebounce } from "@/hooks/use-debounce";

interface CourseWithModules {
  id: string;
  title: string;
  modules: { id: string; title: string }[];
}

interface JournalEditorProps {
  courses: CourseWithModules[];
  initialCourseId?: string;
  initialModuleId?: string;
  guidedPrompt?: string;
  existingEntry?: {
    id: string;
    title: string;
    content: string;
    isPrivate: boolean;
    courseId: string | null;
    moduleId: string | null;
  };
}

export const JournalEditor = ({
  courses,
  initialCourseId,
  initialModuleId,
  guidedPrompt,
  existingEntry,
}: JournalEditorProps) => {
  const router = useRouter();
  const [title, setTitle] = useState(existingEntry?.title ?? "");
  const [content, setContent] = useState(existingEntry?.content ?? "");
  const [isPrivate, setIsPrivate] = useState(existingEntry?.isPrivate ?? true);
  const [courseId, setCourseId] = useState(
    existingEntry?.courseId ?? initialCourseId ?? ""
  );
  const [moduleId, setModuleId] = useState(
    existingEntry?.moduleId ?? initialModuleId ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [entryId, setEntryId] = useState(existingEntry?.id ?? "");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const debouncedTitle = useDebounce(title, 5000);
  const debouncedContent = useDebounce(content, 5000);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const modules = selectedCourse?.modules ?? [];

  const wordCount = content
    .replace(/<[^>]*>/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const save = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      if (entryId) {
        await axios.patch(`/api/journal/${entryId}`, {
          title,
          content,
          isPrivate,
          courseId: courseId || null,
          moduleId: moduleId || null,
        });
      } else {
        const response = await axios.post("/api/journal", {
          title,
          content,
          isPrivate,
          prompt: guidedPrompt || null,
          courseId: courseId || null,
          moduleId: moduleId || null,
        });
        setEntryId(response.data.id);
        // Update URL without full navigation
        window.history.replaceState(null, "", `/journal/${response.data.id}`);
      }
      setLastSaved(new Date());
    } catch {
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [title, content, isPrivate, courseId, moduleId, entryId, guidedPrompt]);

  // Auto-save on debounced changes
  useEffect(() => {
    if (debouncedTitle && debouncedContent && (debouncedTitle.trim() || debouncedContent.trim())) {
      save();
    }
  }, [debouncedTitle, debouncedContent, save]);

  const onDelete = async () => {
    if (!entryId) return;
    try {
      await axios.delete(`/api/journal/${entryId}`);
      toast.success("Entry deleted");
      router.push("/journal");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/journal"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Journal
        </Link>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-muted-foreground/70">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {isSaving && (
            <span className="text-xs text-akomapa-teal">Saving...</span>
          )}
          <Button
            onClick={save}
            disabled={isSaving || !title.trim()}
            size="sm"
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          {entryId && (
            <Button onClick={onDelete} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {guidedPrompt && (
        <div className="bg-akomapa-teal/5 border border-akomapa-teal/20 rounded-lg p-4">
          <p className="text-sm font-medium text-akomapa-teal-dark">
            Guided Reflection Prompt
          </p>
          <p className="text-sm text-muted-foreground mt-1">{guidedPrompt}</p>
        </div>
      )}

      <input
        type="text"
        placeholder="Entry title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:ring-0 p-0"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setModuleId("");
          }}
          className="px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-akomapa-teal/20"
        >
          <option value="">No course (general reflection)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          disabled={!courseId}
          className="px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-akomapa-teal/20 disabled:opacity-50"
        >
          <option value="">No specific module</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      <Editor onChange={setContent} value={content} />

      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={!isPrivate}
            onCheckedChange={(checked) => setIsPrivate(!checked)}
          />
          <span className="text-sm text-muted-foreground">
            {isPrivate ? "Private" : "Shared with faculty"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground/70">{wordCount} words</span>
      </div>
    </div>
  );
};
