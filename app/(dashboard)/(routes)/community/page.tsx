import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { db } from "@/lib/db";
import { getForumPosts } from "@/actions/get-forum-posts";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "./_components/category-tabs";
import { PostSearch } from "./_components/post-search";
import { PostCard } from "./_components/post-card";

const CommunityPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);

  const [categories, { posts, hasMore }] = await Promise.all([
    db.forumCategory.findMany({ orderBy: { position: "asc" } }),
    getForumPosts({
      userId,
      categoryId: params.category || undefined,
      search: params.q || undefined,
      sort: (params.sort as "recent" | "most_liked" | "most_discussed") || "recent",
      page,
      limit: 20,
    }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Community</h1>
        <Button asChild>
          <Link href="/community/new">
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Link>
        </Button>
      </div>

      <CategoryTabs categories={categories} />
      <PostSearch />

      {posts.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] border border-dashed border-slate-300 rounded-lg">
          <div className="text-center">
            <p className="text-slate-500 text-lg">No posts yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Be the first to start a discussion!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link
              href={`/community?${new URLSearchParams({
                ...(params.category && { category: params.category }),
                ...(params.q && { q: params.q }),
                ...(params.sort && { sort: params.sort }),
                page: String(page + 1),
              }).toString()}`}
            >
              Load More
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
