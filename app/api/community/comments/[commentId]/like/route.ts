import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { commentId } = await params;

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
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_COMMENT_LIKE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
