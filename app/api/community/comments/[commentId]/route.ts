import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { commentId } = await params;
    const { content } = await req.json();

    if (!content) {
      return new NextResponse("Content is required", { status: 400 });
    }

    const comment = await db.forumComment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (comment.userId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const updated = await db.forumComment.update({
      where: { id: commentId },
      data: { content },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError("COMMUNITY_COMMENT_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { commentId } = await params;

    const comment = await db.forumComment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const admin = await isAdmin(userId);
    if (comment.userId !== userId && !admin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await db.forumComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("COMMUNITY_COMMENT_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
