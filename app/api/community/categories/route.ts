import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const categories = await db.forumCategory.findMany({
      orderBy: { position: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_CATEGORIES_GET", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const principal = await requirePrincipal();
    requireCapability(principal, "community:moderate");

    const { name, description, color, position } = await req.json();

    if (!name) return new NextResponse("Name is required", { status: 400 });

    const category = await db.forumCategory.create({
      data: { name, description, color, position: position ?? 0 },
    });

    return NextResponse.json(category);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("COMMUNITY_CATEGORIES_POST", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
