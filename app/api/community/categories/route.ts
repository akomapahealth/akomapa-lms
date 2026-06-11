import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const categories = await db.forumCategory.findMany({
      orderBy: { position: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    logError("COMMUNITY_CATEGORIES_GET", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const admin = await isAdmin(userId);
    if (!admin) return new NextResponse("Forbidden", { status: 403 });

    const { name, description, color, position } = await req.json();

    if (!name) return new NextResponse("Name is required", { status: 400 });

    const category = await db.forumCategory.create({
      data: { name, description, color, position: position ?? 0 },
    });

    return NextResponse.json(category);
  } catch (error) {
    logError("COMMUNITY_CATEGORIES_POST", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
