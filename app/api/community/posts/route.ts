import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { title, content, categoryId, courseId } = await req.json();

    if (!title || !content || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const post = await db.forumPost.create({
      data: {
        title,
        content,
        categoryId,
        courseId: courseId || null,
        userId,
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.log("[COMMUNITY_POSTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
