"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onCancel?: () => void;
  placeholder?: string;
}

export const CommentForm = ({
  postId,
  parentId,
  onCancel,
  placeholder = "Write a comment...",
}: CommentFormProps) => {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setIsLoading(true);
      await axios.post(`/api/community/posts/${postId}/comments`, {
        content: content.trim(),
        parentId: parentId || undefined,
      });
      setContent("");
      onCancel?.();
      router.refresh();
      toast.success("Comment posted");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        rows={3}
      />
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !content.trim()}
        >
          {parentId ? "Reply" : "Post Comment"}
        </Button>
      </div>
    </form>
  );
};
