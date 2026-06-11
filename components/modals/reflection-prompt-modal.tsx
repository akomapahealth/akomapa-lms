"use client";

import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReflectionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
  prompt: string;
  courseId: string;
  moduleId: string;
}

export const ReflectionPromptModal = ({
  isOpen,
  onClose,
  moduleName,
  prompt,
  courseId,
  moduleId,
}: ReflectionPromptModalProps) => {
  const router = useRouter();

  const onWriteReflection = () => {
    const params = new URLSearchParams({
      courseId,
      moduleId,
      prompt,
    });
    router.push(`/journal/new?${params.toString()}`);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Module Complete: {moduleName}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Take a moment to reflect on what you learned.
            </span>
            <span className="block bg-slate-50 border rounded-md p-3 text-sm italic text-slate-700">
              {prompt}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Skip for now</AlertDialogCancel>
          <AlertDialogAction onClick={onWriteReflection}>
            Write a Reflection
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
