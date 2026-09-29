import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseParams, problem } from "@/lib/http";
import { postParams } from "@/lib/validations/ids";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

    const { postId } = parseParams(postParams, await params);

    const post = await db.forumPost.findUnique({
      where: { id: postId },
      select: { isLocked: true },
    });

    if (!post) {
      return problem("not_found");
    }

    const updated = await db.forumPost.update({
      where: { id: postId },
      data: { isLocked: !post.isLocked },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("COMMUNITY_POST_LOCK", error);
  }
}
