import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizePost, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

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
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_POST_GET", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    // Author or moderator. The rule lives in lib/auth/policy.ts rather than
    // being re-derived at each of the call sites that used to inline it.
    const principal = await requirePrincipal();
    await authorizePost(principal, "post:update", postId);

    const { title, content, categoryId } = await req.json();

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
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_POST_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    const principal = await requirePrincipal();
    await authorizePost(principal, "post:delete", postId);

    await db.forumPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_POST_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
