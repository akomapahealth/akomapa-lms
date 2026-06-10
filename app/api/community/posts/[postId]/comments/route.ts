import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { postId } = await params;
    const { content, parentId } = await req.json();

    if (!content) {
      return new NextResponse("Content is required", { status: 400 });
    }

    // Check post exists and isn't locked
    const post = await db.forumPost.findUnique({
      where: { id: postId },
      select: { isLocked: true },
    });

    if (!post) {
      return new NextResponse("Post not found", { status: 404 });
    }

    if (post.isLocked) {
      return new NextResponse("Post is locked", { status: 403 });
    }

    // Enforce max 2 levels of nesting
    if (parentId) {
      const parent = await db.forumComment.findUnique({
        where: { id: parentId },
        select: { postId: true, parentId: true },
      });

      if (!parent || parent.postId !== postId) {
        return new NextResponse("Invalid parent comment", { status: 400 });
      }

      if (parent.parentId) {
        return new NextResponse("Maximum nesting depth reached", {
          status: 400,
        });
      }
    }

    const comment = await db.forumComment.create({
      data: {
        content,
        userId,
        postId,
        parentId: parentId || null,
      },
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
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.log("[COMMUNITY_COMMENT_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
