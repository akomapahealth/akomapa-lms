import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { categoryCreateSchema } from "@/lib/validations/community";

export async function GET() {
  try {
    const categories = await db.forumCategory.findMany({
      orderBy: { position: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    return handleRouteError("COMMUNITY_CATEGORIES_GET", error);
  }
}

export async function POST(req: Request) {
  try {
    assertTrustedOrigin(req);

    const principal = await requirePrincipal();
    await enforceRateLimit(req, "write.default", { userId: principal.userId });
    requireCapability(principal, "community:moderate");

    // Bounded and strict before the write. The body used to be destructured
    // straight into `create`, so `name` could be any type or length and
    // `position` any number.
    const body = await parseBody(categoryCreateSchema, req);

    const category = await db.forumCategory.create({
      data: {
        name: body.name,
        description: body.description,
        color: body.color,
        position: body.position ?? 0,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    return handleRouteError("COMMUNITY_CATEGORIES_POST", error);
  }
}
