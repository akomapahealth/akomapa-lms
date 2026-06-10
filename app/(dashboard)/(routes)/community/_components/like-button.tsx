"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

import { cn } from "@/lib/utils";

interface LikeButtonProps {
  postId?: string;
  commentId?: string;
  initialLiked: boolean;
  initialCount: number;
}

export const LikeButton = ({
  postId,
  commentId,
  initialLiked,
  initialCount,
}: LikeButtonProps) => {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      setIsLoading(true);
      // Optimistic update
      setLiked(!liked);
      setCount(liked ? count - 1 : count + 1);

      const url = postId
        ? `/api/community/posts/${postId}/like`
        : `/api/community/comments/${commentId}/like`;

      const response = await axios.post(url);
      setLiked(response.data.liked);
      setCount(response.data.count);
    } catch {
      // Revert on error
      setLiked(liked);
      setCount(count);
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-1 text-sm transition",
        liked
          ? "text-rose-500"
          : "text-slate-500 hover:text-rose-500"
      )}
    >
      <Heart
        className={cn("h-4 w-4", liked && "fill-current")}
      />
      <span>{count}</span>
    </button>
  );
};
