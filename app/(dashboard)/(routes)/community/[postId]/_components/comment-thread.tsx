"use client";

import { useState } from "react";
import { Reply } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { LikeButton } from "../../_components/like-button";
import { CommentForm } from "./comment-form";

interface CommentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: string;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
  likes: { id: string }[];
  _count: { likes: number };
  replies?: CommentData[];
}

interface CommentThreadProps {
  comments: CommentData[];
  postId: string;
  isLocked: boolean;
}

export const CommentThread = ({
  comments,
  postId,
  isLocked,
}: CommentThreadProps) => {
  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          isLocked={isLocked}
          isReply={false}
        />
      ))}
    </div>
  );
};

function CommentItem({
  comment,
  postId,
  isLocked,
  isReply,
}: {
  comment: CommentData;
  postId: string;
  isLocked: boolean;
  isReply: boolean;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  const authorName =
    [comment.user.firstName, comment.user.lastName]
      .filter(Boolean)
      .join(" ") || "Anonymous";
  const initials =
    [comment.user.firstName?.[0], comment.user.lastName?.[0]]
      .filter(Boolean)
      .join("") || "?";

  return (
    <div className={isReply ? "ml-8 pl-4 border-l-2 border-border/50" : ""}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.user.imageUrl ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">
              {authorName}
            </span>
            {comment.user.role !== "STUDENT" && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-akomapa-ice text-akomapa-teal">
                {comment.user.role === "ADMIN" ? "Admin" : "Faculty"}
              </span>
            )}
            <span className="text-xs text-muted-foreground/70">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="text-sm text-foreground whitespace-pre-wrap mb-2">
            {comment.content}
          </p>

          <div className="flex items-center gap-3">
            <LikeButton
              commentId={comment.id}
              initialLiked={comment.likes.length > 0}
              initialCount={comment._count.likes}
            />
            {!isLocked && !isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <Reply className="h-3.5 w-3.5 mr-1" />
                Reply
              </Button>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onCancel={() => setShowReplyForm(false)}
                placeholder="Write a reply..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              isLocked={isLocked}
              isReply={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
