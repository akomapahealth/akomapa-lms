import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
        category: {
          select: { id: true, name: true, color: true },
        },
        course: {
          select: { id: true, title: true },
        },
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

    if (!post) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.log("[COMMUNITY_POST_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { postId } = await params;
    const { title, content, categoryId } = await req.json();

    const post = await db.forumPost.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const admin = await isAdmin(userId);
    if (post.userId !== userId && !admin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const updated = await db.forumPost.update({
      where: { id: postId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(categoryId !== undefined && { categoryId }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.log("[COMMUNITY_POST_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { postId } = await params;

    const post = await db.forumPost.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const admin = await isAdmin(userId);
    if (post.userId !== userId && !admin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await db.forumPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("[COMMUNITY_POST_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
