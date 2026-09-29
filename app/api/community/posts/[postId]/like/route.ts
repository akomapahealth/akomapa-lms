import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseParams } from "@/lib/http";
import { postParams } from "@/lib/validations/ids";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { postId } = parseParams(postParams, await params);

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
    return handleRouteError("COMMUNITY_POST_LIKE", error);
  }
}
