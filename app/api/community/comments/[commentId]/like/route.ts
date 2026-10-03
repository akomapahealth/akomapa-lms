import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { commentParams } from "@/lib/validations/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();
    await enforceRateLimit(req, "community.react", { userId: userId });

    const { commentId } = parseParams(commentParams, await params);

    const existing = await db.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await db.commentLike.delete({
        where: { id: existing.id },
      });
    } else {
      await db.commentLike.create({
        data: { userId, commentId },
      });
    }

    const count = await db.commentLike.count({ where: { commentId } });

    return NextResponse.json({
      liked: !existing,
      count,
    });
  } catch (error) {
    return handleRouteError("COMMUNITY_COMMENT_LIKE", error);
  }
}
