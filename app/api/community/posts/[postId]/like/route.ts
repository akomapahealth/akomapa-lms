import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { postId } = await params;

    const existing = await db.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await db.postLike.delete({
        where: { id: existing.id },
      });
    } else {
      await db.postLike.create({
        data: { userId, postId },
      });
    }

    const count = await db.postLike.count({ where: { postId } });

    return NextResponse.json({
      liked: !existing,
      count,
    });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_POST_LIKE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
