import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function POST(
    req: Request,
) {
    try {
        const { userId } = await auth();
        const { title } = await req.json();

        if (!userId || !(await isFaculty(userId))) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const course = await db.course.create({
            data: {
                userId,
                title,
            }
        });

        return NextResponse.json(course);
    } catch (error) {
        logError("COURSES", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}