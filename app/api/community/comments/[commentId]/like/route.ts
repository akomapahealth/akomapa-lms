import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
    logError("COMMUNITY_COMMENT_LIKE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
