import { db } from "@/lib/db";

export interface ForumPostPreview {
  id: string;
  title: string;
  excerpt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  category: {
    id: string;
    name: string;
    color: string;
  };
  course?: {
    id: string;
    title: string;
  } | null;
  likeCount: number;
  commentCount: number;
  isLikedByUser: boolean;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: Date;
}

interface GetForumPostsParams {
  userId?: string;
  categoryId?: string;
  courseId?: string;
  sort?: "recent" | "most_liked" | "most_discussed";
  search?: string;
  page?: number;
  limit?: number;
}

interface GetForumPostsResult {
  posts: ForumPostPreview[];
  totalCount: number;
  hasMore: boolean;
}

export const getForumPosts = async (
  params: GetForumPostsParams
): Promise<GetForumPostsResult> => {
  try {
    const {
      userId,
      categoryId,
      courseId,
      sort = "recent",
      search,
      page = 1,
      limit = 20,
    } = params;

    const where: Record<string, unknown> = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (courseId) {
      where.courseId = courseId;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    let orderBy: Record<string, unknown> = { createdAt: "desc" };
    if (sort === "most_liked") {
      orderBy = { likes: { _count: "desc" } };
    } else if (sort === "most_discussed") {
      orderBy = { comments: { _count: "desc" } };
    }

    const skip = (page - 1) * limit;

    const postInclude = {
      user: {
        select: { id: true, firstName: true, lastName: true, imageUrl: true },
      },
      category: {
        select: { id: true, name: true, color: true },
      },
      course: {
        select: { id: true, title: true },
      },
      _count: { select: { comments: true, likes: true } },
      likes: userId
        ? { where: { userId }, select: { id: true } }
        : { take: 0, select: { id: true } },
    } as const;

    type PostWithIncludes = Awaited<
      ReturnType<typeof db.forumPost.findMany<{ include: typeof postInclude }>>
    >[number];

    const mapPost = (post: PostWithIncludes): ForumPostPreview => ({
      id: post.id,
      title: post.title,
      excerpt: stripHtml(post.content).slice(0, 150),
      author: post.user,
      category: post.category,
      course: post.course,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      isLikedByUser: post.likes.length > 0,
      isPinned: post.isPinned,
      isLocked: post.isLocked,
      createdAt: post.createdAt,
    });

    // Fetch pinned posts only on first page
    let pinnedPosts: ForumPostPreview[] = [];
    if (page === 1) {
      const pinned = await db.forumPost.findMany({
        where: { ...where, isPinned: true },
        orderBy: { createdAt: "desc" },
        include: postInclude,
      });
      pinnedPosts = pinned.map(mapPost);
    }

    // Fetch regular (non-pinned) posts
    const [posts, totalCount] = await Promise.all([
      db.forumPost.findMany({
        where: { ...where, isPinned: false },
        orderBy,
        skip,
        take: limit,
        include: postInclude,
      }),
      db.forumPost.count({ where: { ...where, isPinned: false } }),
    ]);

    const regularPosts = posts.map(mapPost);

    return {
      posts: [...pinnedPosts, ...regularPosts],
      totalCount: totalCount + pinnedPosts.length,
      hasMore: skip + limit < totalCount,
    };
  } catch (error) {
    console.log("[GET_FORUM_POSTS]", error);
    return { posts: [], totalCount: 0, hasMore: false };
  }
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
