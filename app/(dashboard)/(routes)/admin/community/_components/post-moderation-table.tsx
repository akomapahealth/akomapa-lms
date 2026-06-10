"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin, Lock, Trash } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

interface PostRow {
  id: string;
  title: string;
  author: string;
  categoryName: string;
  categoryColor: string;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: Date;
}

interface PostModerationTableProps {
  posts: PostRow[];
}

export const PostModerationTable = ({ posts }: PostModerationTableProps) => {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const onAction = async (postId: string, action: "pin" | "lock" | "delete") => {
    try {
      setLoadingId(postId);
      if (action === "delete") {
        await axios.delete(`/api/community/posts/${postId}`);
        toast.success("Post deleted");
      } else {
        await axios.patch(`/api/community/posts/${postId}/${action}`);
        toast.success(action === "pin" ? "Pin toggled" : "Lock toggled");
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-center">Likes</TableHead>
          <TableHead className="text-center">Comments</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-slate-400 py-8">
              No posts yet
            </TableCell>
          </TableRow>
        ) : (
          posts.map((post) => (
            <TableRow key={post.id}>
              <TableCell className="font-medium max-w-[200px] truncate">
                {post.title}
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {post.author}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: post.categoryColor,
                    color: post.categoryColor,
                  }}
                >
                  {post.categoryName}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-sm">{post.likeCount}</TableCell>
              <TableCell className="text-center text-sm">{post.commentCount}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {post.isPinned && (
                    <Badge variant="secondary" className="text-[10px]">Pinned</Badge>
                  )}
                  {post.isLocked && (
                    <Badge variant="destructive" className="text-[10px]">Locked</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-slate-500">
                {timeAgo(post.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAction(post.id, "pin")}
                    disabled={loadingId === post.id}
                    title={post.isPinned ? "Unpin" : "Pin"}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAction(post.id, "lock")}
                    disabled={loadingId === post.id}
                    title={post.isLocked ? "Unlock" : "Lock"}
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onAction(post.id, "delete")}
                    disabled={loadingId === post.id}
                    className="text-red-500 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};
