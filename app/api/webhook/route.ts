import Stripe from "stripe";
import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { recordPaidEnrollment } from "@/lib/entitlement";
import { requireEnv } from "@/lib/env";
import { handleRouteError, problem } from "@/lib/http";
import { logError } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkoutMetadataSchema } from "@/lib/validations/webhooks";

/**
 * Stripe payment events.
 *
 * Authenticated by signature, not by principal, so this route does not use the
 * `lib/auth` guards. It still needs its envelope validated: a verified signature
 * proves Stripe sent the message, not that the metadata inside is the pair of
 * ids this handler is about to write a Purchase row from.
 *
 * Delivery semantics -- duplicate events, reordering, retry-safety -- are #54's
 * and #69's. This route deliberately does not change them beyond making the
 * Purchase/Enrollment pair idempotent, which #48 requires.
 */
export async function POST(req: Request) {
    // Limited by sender address before the body is read or the signature is
    // checked, so a flood of forged deliveries costs a counter increment rather
    // than a signature computation each (#46). Fails open: a lost provider
    // event is worse than a briefly unlimited one, and a 429 is retried.
    try {
        await enforceRateLimit(req, "webhook.stripe");
    } catch (error) {
        return handleRouteError("STRIPE_WEBHOOK", error);
    }

    const body = await req.text();
    // Read from the request itself rather than `next/headers`, which needs a
    // Next.js request scope and so cannot be exercised by a route-level test of
    // this route's exemption from the origin guard (#45).
    const signature = req.headers.get("Stripe-Signature");

    if (signature === null) {
        return problem("invalid_parameter", { message: "Missing Stripe signature." });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            requireEnv("STRIPE_WEBHOOK_SECRET")
        );
    } catch (error) {
        // The verifier's message can quote the payload, so it is logged rather
        // than returned.
        logError("STRIPE_WEBHOOK_SIGNATURE", error);
        return problem("invalid_parameter", { message: "Signature verification failed." });
    }

    // Acknowledged, not processed. Stripe retries anything that is not a 2xx, so
    // an event this app does not handle must not be reported as a failure.
    if (event.type !== "checkout.session.completed") {
        return new NextResponse(null, { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // The ids are validated, not merely checked for presence: they are written
    // to a Purchase row, and `session.metadata` is whatever was set when the
    // session was created.
    const metadata = checkoutMetadataSchema.safeParse(session.metadata ?? {});

    if (!metadata.success) {
        logError("STRIPE_WEBHOOK_METADATA", new Error("invalid checkout metadata"), {
            eventId: event.id,
        });
        return problem("validation_failed", {
            message: "Checkout session metadata is missing or malformed.",
        });
    }

    // The Purchase and the Enrollment together, in one transaction. Writing only
    // the Purchase was enough while access was read from it; now that Enrollment
    // is the entitlement (ADR 0002), a payment that records no Enrollment buys
    // nothing. Idempotent, because a webhook is delivered at least once.
    await recordPaidEnrollment(metadata.data.userId, metadata.data.courseId);

    return new NextResponse(null, { status: 200 });
}
