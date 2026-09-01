import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
    req: Request,
) {
    try {
        const principal = await requirePrincipal();
        requireCapability(principal, "course:create");

        const { title } = await req.json();

        const course = await db.course.create({
            data: {
                // Ownership is set from the principal, never from the request.
                userId: principal.userId,
                title,
            }
        });

        return NextResponse.json(course);
    } catch (error) {
        const denied = toResponse(error);
        if (denied) return denied;

        logError("COURSES", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}