import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";

import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "../../_components/post-card";

const CommunityProfilePage = async ({
  params,
}: {
  params: Promise<{ userId: string }>;
}) => {
  const { userId: currentUserId } = await auth();
  if (!currentUserId) return redirect("/sign-in");

  const { userId: profileUserId } = await params;

  const user = await db.user.findUnique({
    where: { id: profileUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      imageUrl: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) return notFound();

  const posts = await db.forumPost.findMany({
    where: { userId: profileUserId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, imageUrl: true },
      },
      category: { select: { id: true, name: true, color: true } },
      course: { select: { id: true, title: true } },
      _count: { select: { comments: true, likes: true } },
      likes: { where: { userId: currentUserId }, select: { id: true } },
    },
  });

  const [postCount, commentCount] = await Promise.all([
    db.forumPost.count({ where: { userId: profileUserId } }),
    db.forumComment.count({ where: { userId: profileUserId } }),
  ]);

  const authorName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "Anonymous";
  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("") || "?";
  const joinDate = user.createdAt.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const postPreviews = posts.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: post.content.replace(/<[^>]*>/g, "").slice(0, 150),
    author: post.user,
    category: post.category,
    course: post.course,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    isLikedByUser: post.likes.length > 0,
    isPinned: post.isPinned,
    isLocked: post.isLocked,
    createdAt: post.createdAt,
  }));

  return (
    <div className="px-4 py-6 sm:p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/community"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-akomapa-teal transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Link>

      {/* Profile card */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user.imageUrl ?? undefined} />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-foreground">{authorName}</h1>
            <div className="flex items-center gap-2 mt-1">
              {user.role !== "STUDENT" && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-akomapa-ice text-akomapa-teal">
                  {user.role === "ADMIN" ? "Admin" : "Faculty"}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Joined {joinDate}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{postCount} posts</span>
              <span>{commentCount} comments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Posts ({postCount})
        </h2>
        {postPreviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet</p>
        ) : (
          <div className="space-y-3">
            {postPreviews.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityProfilePage;
