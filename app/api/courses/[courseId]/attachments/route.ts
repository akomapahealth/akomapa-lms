import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";


export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();
        await authorizeCourse(principal, "attachment:create", routeParams.courseId);
        const { url } = await req.json();

        const attachment = await db.attachment.create({
            data: {
                url,
                name: url.split("/").pop(),
                courseId: routeParams.courseId,
            }
        });

        return NextResponse.json(attachment);

    } catch (error) {
        const denied = toResponse(error);
        if (denied) return denied;

        logError("COURSE_ID_ATTACHMENTS", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}