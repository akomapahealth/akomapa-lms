import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Lock, MessageSquare } from "lucide-react";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { timeAgo } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/banner";
import { Preview } from "@/components/preview";
import { LikeButton } from "../_components/like-button";
import { CommentThread } from "./_components/comment-thread";
import { CommentForm } from "./_components/comment-form";
import { PostActions } from "./_components/post-actions";

const PostDetailPage = async ({
  params,
}: {
  params: Promise<{ postId: string }>;
}) => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const { postId } = await params;

  const post = await db.forumPost.findUnique({
    where: { id: postId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          role: true,
        },
      },
      category: { select: { id: true, name: true, color: true } },
      course: { select: { id: true, title: true } },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
              role: true,
            },
          },
          likes: { where: { userId }, select: { id: true } },
          _count: { select: { likes: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  imageUrl: true,
                  role: true,
                },
              },
              likes: { where: { userId }, select: { id: true } },
              _count: { select: { likes: true } },
            },
          },
        },
      },
      likes: { where: { userId }, select: { id: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) return notFound();

  const admin = await isAdmin(userId);
  const isAuthor = post.userId === userId;

  const authorName =
    [post.user.firstName, post.user.lastName].filter(Boolean).join(" ") ||
    "Anonymous";
  const initials =
    [post.user.firstName?.[0], post.user.lastName?.[0]]
      .filter(Boolean)
      .join("") || "?";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/community"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-akomapa-teal transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Link>

      {post.isLocked && (
        <Banner
          variant="warning"
          label="This post is locked. New comments are not allowed."
        />
      )}

      {/* Post header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-800">{post.title}</h1>
          <PostActions
            postId={post.id}
            isAuthor={isAuthor}
            isAdmin={admin}
            isPinned={post.isPinned}
            isLocked={post.isLocked}
          />
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: post.category.color,
              color: post.category.color,
            }}
          >
            {post.category.name}
          </Badge>
          {post.course && (
            <Badge variant="secondary" className="text-xs">
              {post.course.title}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <Link href={`/community/profile/${post.user.id}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.user.imageUrl ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link
              href={`/community/profile/${post.user.id}`}
              className="text-sm font-medium text-slate-800 hover:text-akomapa-teal transition"
            >
              {authorName}
            </Link>
            {post.user.role !== "STUDENT" && (
              <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-akomapa-ice text-akomapa-teal">
                {post.user.role === "ADMIN" ? "Admin" : "Faculty"}
              </span>
            )}
            <p className="text-xs text-slate-400">
              {timeAgo(post.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Post content */}
      <div className="border border-slate-200 rounded-lg p-6 bg-white">
        <Preview value={post.content} />
      </div>

      {/* Like section */}
      <div className="flex items-center gap-4">
        <LikeButton
          postId={post.id}
          initialLiked={post.likes.length > 0}
          initialCount={post._count.likes}
        />
      </div>

      {/* Comments section */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">
            {post._count.comments} {post._count.comments === 1 ? "Comment" : "Comments"}
          </h2>
        </div>

        <CommentThread
          comments={post.comments as unknown as Parameters<typeof CommentThread>[0]["comments"]}
          postId={post.id}
          isLocked={post.isLocked}
        />

        {!post.isLocked && (
          <div className="mt-6">
            <CommentForm postId={post.id} />
          </div>
        )}

        {post.isLocked && (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
            <Lock className="h-4 w-4" />
            Comments are locked on this post
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;
