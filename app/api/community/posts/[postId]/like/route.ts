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
    console.log("[COMMUNITY_POST_LIKE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
