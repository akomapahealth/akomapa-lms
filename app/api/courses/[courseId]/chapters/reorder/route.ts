import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();
        await authorizeCourse(principal, "topic:reorder", routeParams.courseId);

        const { list } = await req.json();

        for (let item of list) {
            await db.topic.update({
                where: { id: item.id },
                data: { position: item.position }
            });
        }

        return new NextResponse("Success", { status: 200 });

    } catch (error) {
        const denied = toResponse(error);
        if (denied) return denied;

        logError("REORDER", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}