import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseParams } from "@/lib/validations/ids";
import {
    attachmentCreateSchema,
    attachmentNameFrom,
} from "@/lib/validations/attachment";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(courseParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });
        await authorizeCourse(principal, "attachment:create", routeParams.courseId);

        // A real http(s) URL. The bare body allowed any string, so `url` could be
        // `javascript:...` -- later rendered as an href -- and `name` was derived
        // with `url.split("/").pop()`, which is `undefined` for a URL ending in a
        // slash and was written to a non-null column.
        const { url } = await parseBody(attachmentCreateSchema, req);

        const attachment = await db.attachment.create({
            data: {
                url,
                name: attachmentNameFrom(url),
                courseId: routeParams.courseId,
            }
        });

        return NextResponse.json(attachment);

    } catch (error) {
        return handleRouteError("COURSE_ID_ATTACHMENTS", error);
    }
}
