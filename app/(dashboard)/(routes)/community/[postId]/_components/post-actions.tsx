"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash, Pin, Lock } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PostActionsProps {
  postId: string;
  isAuthor: boolean;
  isAdmin: boolean;
  isPinned: boolean;
  isLocked: boolean;
}

export const PostActions = ({
  postId,
  isAuthor,
  isAdmin,
  isPinned,
  isLocked,
}: PostActionsProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const onDelete = async () => {
    try {
      setIsLoading(true);
      await axios.delete(`/api/community/posts/${postId}`);
      toast.success("Post deleted");
      router.push("/community");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const onPin = async () => {
    try {
      setIsLoading(true);
      await axios.patch(`/api/community/posts/${postId}/pin`);
      toast.success(isPinned ? "Post unpinned" : "Post pinned");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const onLock = async () => {
    try {
      setIsLoading(true);
      await axios.patch(`/api/community/posts/${postId}/lock`);
      toast.success(isLocked ? "Post unlocked" : "Post locked");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthor && !isAdmin) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isLoading}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAuthor && (
          <DropdownMenuItem
            onClick={() => router.push(`/community/${postId}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={onPin}>
              <Pin className="h-4 w-4 mr-2" />
              {isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLock}>
              <Lock className="h-4 w-4 mr-2" />
              {isLocked ? "Unlock" : "Lock"}
            </DropdownMenuItem>
          </>
        )}
        {(isAuthor || isAdmin) && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600"
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
