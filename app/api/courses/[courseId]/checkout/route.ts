import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { courseEntitlement, LOCKED_STATE_MESSAGE } from "@/lib/entitlement";
import { stripe } from "@/lib/stripe";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { assertTrustedOrigin, handleRouteError, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseParams } from "@/lib/validations/ids";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(courseParams, await params);

        // Identity comes from the one derivation point (ADR 0001 section 1);
        // `currentUser` is used only for the email address Stripe needs. This
        // is a money path, so it must not resolve who is paying a second way.
        const principal = await requirePrincipal();
        await enforceRateLimit(req, "checkout.create", { userId: principal.userId });
        const { userId } = principal;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;

        if (!email) {
            return problem("unauthenticated", {
                message: "Your account has no email address on file.",
            });
        }

        const course = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                isPublished: true,
            }
        });

        // Whether they already have access, not whether they ever paid. A
        // scholarship or staff enrolment has no Purchase row, and reading
        // `Purchase` would have charged such a learner a second time for a Course
        // they can already open.
        const entitlement = await courseEntitlement(principal, routeParams.courseId);

        if (!course) {
            return problem("not_found");
        }

        if (entitlement.canLearn) {
            // A conflict, not bad input. Checked after the Course lookup so an
            // unpublished or nonexistent Course answers 404 either way rather
            // than revealing that the caller already owns something.
            return problem("conflict", {
                message: "You already have access to this course.",
            });
        }

        // A suspended learner must not be able to buy their way back in. Lifting a
        // suspension is an administrative act (#88), not a checkout.
        if (entitlement.reason === "suspended") {
            return problem("forbidden", {
                message: LOCKED_STATE_MESSAGE.suspended,
            });
        }

        // The column is a nullable float (#55 replaces it with exact money), so a
        // Course with no price set would reach `Math.round(price * 100)` as NaN
        // and create a Stripe session for an unpayable amount.
        if (course.price === null || !Number.isFinite(course.price)) {
            return problem("conflict", {
                message: "This course is not available for purchase yet.",
            });
        }

        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            {
                quantity: 1,
                price_data: {
                    currency: "USD",
                    product_data: {
                        name: course.title,
                        description: course.description ?? undefined,
                    },
                    unit_amount: Math.round(course.price * 100),
                }
            }
        ];

        let stripeCustomer = await db.stripCustomer.findUnique({
            where: {
                userId,
            },
            select: {
                stripeCustomerId: true,
            }
        });

        if (!stripeCustomer) {
            const customer = await stripe.customers.create({
                email: email,
            });

            stripeCustomer = await db.stripCustomer.create({
                data: {
                    userId,
                    stripeCustomerId: customer.id,
                }
            });
        }

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomer.stripeCustomerId,
            line_items,
            mode: "payment",
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${course.id}?success=1`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${course.id}?canceled=1`,
            metadata: {
                courseId: course.id,
                userId,
            }
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        return handleRouteError("COURSE_ID_CHECKOUT", error);
    }
}