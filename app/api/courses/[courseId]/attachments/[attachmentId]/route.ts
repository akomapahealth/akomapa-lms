import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string; attachmentId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();
        await authorizeCourse(principal, "attachment:delete", routeParams.courseId);

        const attachment = await db.attachment.delete({
            where: {
                id: routeParams.attachmentId,
                courseId: routeParams.courseId,
            }
        });

        return NextResponse.json(attachment);
    } catch (error) {
        const denied = toResponse(error);
        if (denied) return denied;

        logError("ATTACHMENT_ID", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}