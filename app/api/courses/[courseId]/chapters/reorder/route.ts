import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { NextResponse } from "next/server";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseParams } from "@/lib/validations/ids";
import { reorderSchema } from "@/lib/validations/reorder";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(courseParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });
        await authorizeCourse(principal, "topic:reorder", routeParams.courseId);

        // Bounded and typed. `list` was `any`: unbounded in length, with ids of
        // any type, one UPDATE per element.
        const { list } = await parseBody(reorderSchema, req, BODY_BYTES.reorder);

        // Every id must be a Topic in *this* Course. Authorization proved the
        // caller owns the Course in the URL; it said nothing about the ids in the
        // body, and the update below matched on `id` alone -- so an author of any
        // Course could renumber the Topics of any other.
        const ids = list.map((item) => item.id);
        const owned = await db.topic.findMany({
            where: { id: { in: ids }, module: { courseId: routeParams.courseId } },
            select: { id: true },
        });

        if (owned.length !== ids.length) {
            // One answer whether an id is absent or belongs elsewhere, so the
            // route cannot be used to test which Topics exist.
            return problem("not_found");
        }

        // One transaction: a partial reorder leaves two Topics sharing a position
        // and the sidebar ordering non-deterministic.
        await db.$transaction(
            list.map((item) =>
                db.topic.update({
                    where: { id: item.id },
                    data: { position: item.position },
                })
            )
        );

        return new NextResponse(null, { status: 204 });

    } catch (error) {
        return handleRouteError("REORDER", error);
    }
}
