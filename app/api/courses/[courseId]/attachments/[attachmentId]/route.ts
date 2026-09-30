import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { NextResponse } from "next/server";
import { handleRouteError, parseParams } from "@/lib/http";
import { attachmentParams } from "@/lib/validations/ids";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string; attachmentId: string }> }
) {
    try {
        const routeParams = parseParams(attachmentParams, await params);

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
        return handleRouteError("ATTACHMENT_ID", error);
    }
}