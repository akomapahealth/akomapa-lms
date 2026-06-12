import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostModerationTable } from "./_components/post-moderation-table";
import { CategoryManager } from "./_components/category-manager";
import { PageContainer } from "@/components/shell/page-container";

const AdminCommunityPage = async () => {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const [posts, categories] = await Promise.all([
    db.forumPost.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { firstName: true, lastName: true } },
        category: { select: { name: true, color: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    db.forumCategory.findMany({ orderBy: { position: "asc" } }),
  ]);

  const postRows = posts.map((post) => ({
    id: post.id,
    title: post.title,
    author: [post.user.firstName, post.user.lastName].filter(Boolean).join(" ") || "Anonymous",
    categoryName: post.category.name,
    categoryColor: post.category.color,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    isPinned: post.isPinned,
    isLocked: post.isLocked,
    createdAt: post.createdAt,
  }));

  return (
    <PageContainer width="wide" className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Community Management</h1>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="mt-4">
          <PostModerationTable posts={postRows} />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoryManager categories={categories} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default AdminCommunityPage;
