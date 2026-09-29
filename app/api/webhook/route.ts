import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import { problem } from "@/lib/http";
import { logError } from "@/lib/logger";
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
 * and #69's. This route deliberately does not change them.
 */
export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature");

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

    await db.purchase.create({
        data: {
            courseId: metadata.data.courseId,
            userId: metadata.data.userId,
        }
    });

    return new NextResponse(null, { status: 200 });
}
