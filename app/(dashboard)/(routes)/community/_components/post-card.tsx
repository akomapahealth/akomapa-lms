import Link from "next/link";
import { Heart, MessageSquare, Pin, Lock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { type ForumPostPreview } from "@/actions/get-forum-posts";

interface PostCardProps {
  post: ForumPostPreview;
}

export const PostCard = ({ post }: PostCardProps) => {
  const authorName = [post.author.firstName, post.author.lastName]
    .filter(Boolean)
    .join(" ") || "Anonymous";
  const initials = [post.author.firstName?.[0], post.author.lastName?.[0]]
    .filter(Boolean)
    .join("") || "?";

  return (
    <Link href={`/community/${post.id}`}>
      <div className="group border border-slate-200 rounded-lg p-4 hover:shadow-md transition bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {post.isPinned && (
                <Pin className="h-3.5 w-3.5 text-akomapa-teal flex-shrink-0" />
              )}
              {post.isLocked && (
                <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              )}
              <h3 className="font-semibold text-slate-800 group-hover:text-akomapa-teal transition truncate">
                {post.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={post.author.imageUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-slate-500">
                {authorName} · {timeAgo(post.createdAt)}
              </span>
            </div>

            <p className="text-sm text-slate-600 line-clamp-2 mb-3">
              {post.excerpt}
            </p>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Heart className="h-3.5 w-3.5" />
                <span>{post.likeCount}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{post.commentCount}</span>
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className="flex-shrink-0 text-xs"
            style={{
              borderColor: post.category.color,
              color: post.category.color,
            }}
          >
            {post.category.name}
          </Badge>
        </div>
      </div>
    </Link>
  );
};
