import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const admin = await isAdmin(userId);
    if (!admin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { postId } = await params;

    const post = await db.forumPost.findUnique({
      where: { id: postId },
      select: { isLocked: true },
    });

    if (!post) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const updated = await db.forumPost.update({
      where: { id: postId },
      data: { isLocked: !post.isLocked },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError("COMMUNITY_POST_LOCK", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
