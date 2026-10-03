import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCapability, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody } from "@/lib/http";
import { courseCreateSchema } from "@/lib/validations/course";

export async function POST(req: Request) {
    try {
        assertTrustedOrigin(req);

        const principal = await requirePrincipal();
        requireCapability(principal, "course:create");

        // `title` was read off the body unvalidated, so a Course could be created
        // with a title of any type or length -- including `undefined`, which the
        // non-null column rejected as a 500.
        const { title } = await parseBody(courseCreateSchema, req);

        const course = await db.course.create({
            data: {
                // Ownership is set from the principal, never from the request.
                userId: principal.userId,
                title,
            }
        });

        return NextResponse.json(course);
    } catch (error) {
        return handleRouteError("COURSES", error);
    }
}
