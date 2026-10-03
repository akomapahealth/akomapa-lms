import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { db } from "@/lib/db";
import { handleRouteError, problem } from "@/lib/http";
import { logError } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clerkUserDataSchema, primaryEmailOf } from "@/lib/validations/webhooks";

/**
 * Clerk identity events, which keep the local `User` row in step with Clerk.
 *
 * Authenticated by svix signature rather than by principal. Like the Stripe
 * route, the signature proves the sender and not the shape: `first_name`,
 * `last_name`, and the email list are all genuinely optional in Clerk's payload,
 * and the previous version reached into them with `?.` chains and wrote whatever
 * came out.
 *
 * Logging here used to include the user's id, email address, and name on every
 * event. Email addresses and names identify real people, so they are not logged
 * (policy 01); the event type and a correlation-safe id are enough to debug a
 * delivery.
 */
export async function POST(req: Request) {
  // Limited by sender address before the body is read or the signature is
  // checked, so a flood of forged deliveries costs a counter increment rather
  // than a signature computation each (#46). Fails open: a lost provider
  // event is worse than a briefly unlimited one, and a 429 is retried.
  try {
    await enforceRateLimit(req, "webhook.clerk");
  } catch (error) {
    return handleRouteError("CLERK_WEBHOOK", error);
  }

  try {
    const payload = await req.text();
    // From the request rather than `next/headers`, for the same reason as the
    // Stripe route: the exemption from the origin guard is tested at this layer.
    const headerStore = req.headers;

    const svixId = headerStore.get("svix-id");
    const svixTimestamp = headerStore.get("svix-timestamp");
    const svixSignature = headerStore.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return problem("invalid_parameter", {
        message: "Missing Svix signature headers.",
      });
    }

    const secret = process.env.CLERK_WEBHOOK_SECRET;

    if (!secret) {
      logError("CLERK_WEBHOOK", new Error("CLERK_WEBHOOK_SECRET is not set"));
      return problem("internal");
    }

    let evt: unknown;

    try {
      evt = new Webhook(secret).verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (error) {
      logError("CLERK_WEBHOOK_SIGNATURE", error, { svixId });
      return problem("invalid_parameter", { message: "Invalid signature." });
    }

    const envelope = evt as { type?: unknown; data?: unknown };
    const eventType = typeof envelope.type === "string" ? envelope.type : "unknown";

    if (eventType === "user.created" || eventType === "user.updated") {
      const parsed = clerkUserDataSchema.safeParse(envelope.data);

      if (!parsed.success) {
        // A payload Clerk signed but this app cannot use. Logged without the
        // payload, because it carries the person's name and email address.
        logError("CLERK_WEBHOOK_PAYLOAD", new Error("unexpected user payload"), {
          eventType,
          svixId,
        });
        return problem("validation_failed", {
          message: "The user payload is missing required fields.",
        });
      }

      const data = parsed.data;
      const email = primaryEmailOf(data);

      if (email === undefined) {
        logError("CLERK_WEBHOOK_PAYLOAD", new Error("no email address on account"), {
          eventType,
          svixId,
        });
        return problem("validation_failed", {
          message: "The account has no email address.",
        });
      }

      const fields = {
        email,
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
        imageUrl: data.image_url ?? undefined,
      };

      await db.user.upsert({
        where: { id: data.id },
        create: { id: data.id, ...fields },
        update: fields,
      });
    }

    // Every other event type, `user.deleted` included, is acknowledged without
    // action: deleting the row would break referential integrity with the
    // learner's progress, purchases, and certificates. #117 owns real deletion.
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    logError("CLERK_WEBHOOK", error);
    return problem("internal");
  }
}
