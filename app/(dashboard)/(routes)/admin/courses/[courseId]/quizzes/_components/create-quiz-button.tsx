"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateQuizButtonProps {
  courseId: string;
}

export const CreateQuizButton = ({ courseId }: CreateQuizButtonProps) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("MODULE_QUIZ");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async () => {
    if (!title.trim()) return;

    try {
      setIsLoading(true);
      const response = await axios.post(
        `/api/courses/${courseId}/quizzes`,
        { title, type }
      );
      toast.success("Quiz created!");
      setIsOpen(false);
      setTitle("");
      router.push(`/admin/courses/${courseId}/quizzes/${response.data.id}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-akomapa-teal hover:bg-akomapa-teal-dark text-white">
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Quiz
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new quiz</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Module 1 Quiz"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRE_TEST">Pre-Test</SelectItem>
                <SelectItem value="POST_TEST">Post-Test</SelectItem>
                <SelectItem value="MODULE_QUIZ">Module Quiz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={onSubmit}
            disabled={!title.trim() || isLoading}
            className="w-full"
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
