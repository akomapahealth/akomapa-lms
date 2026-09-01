import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

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
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_POST_LOCK", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
