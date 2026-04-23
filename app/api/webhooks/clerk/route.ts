import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

import { db } from "@/lib/db";

export async function POST(req: Request) {
  console.log("[Clerk Webhook] Received webhook request");
  
  try {
    const payload = await req.text();
    const headerStore = await headers();

    const svixId = headerStore.get("svix-id");
    const svixTimestamp = headerStore.get("svix-timestamp");
    const svixSignature = headerStore.get("svix-signature");

    console.log("[Clerk Webhook] Headers received:", {
      hasSvixId: !!svixId,
      hasSvixTimestamp: !!svixTimestamp,
      hasSvixSignature: !!svixSignature,
    });

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("[Clerk Webhook] Missing Svix signature headers");
      return new NextResponse("Missing Svix signature headers", { status: 400 });
    }

    const secret = process.env.CLERK_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[Clerk Webhook] CLERK_WEBHOOK_SECRET is not set in environment variables");
      return new NextResponse("Webhook not configured", { status: 500 });
    }

    console.log("[Clerk Webhook] Webhook secret is configured");

    const wh = new Webhook(secret);

    let evt: WebhookEvent;

    try {
      evt = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as WebhookEvent;
      console.log("[Clerk Webhook] Webhook signature verified successfully");
    } catch (err) {
      console.error("[Clerk Webhook] Error verifying webhook signature:", err);
      return new NextResponse("Invalid signature", { status: 400 });
    }

    const eventType = evt.type;
    console.log("[Clerk Webhook] Event type:", eventType);

    if (eventType === "user.created" || eventType === "user.updated") {
      const {
        id,
        email_addresses,
        first_name,
        last_name,
        image_url,
      } = evt.data;

      const primaryEmail =
        email_addresses?.find((e) => e.id === evt.data.primary_email_address_id)
          ?.email_address ?? email_addresses?.[0]?.email_address;

      console.log("[Clerk Webhook] Processing user:", {
        id,
        email: primaryEmail,
        firstName: first_name,
        lastName: last_name,
        eventType,
      });

      try {
        const user = await db.user.upsert({
          where: { id },
          create: {
            id,
            email: primaryEmail,
            firstName: first_name ?? undefined,
            lastName: last_name ?? undefined,
            imageUrl: image_url ?? undefined,
          },
          update: {
            email: primaryEmail,
            firstName: first_name ?? undefined,
            lastName: last_name ?? undefined,
            imageUrl: image_url ?? undefined,
          },
        });

        console.log("[Clerk Webhook] User successfully saved to database:", {
          id: user.id,
          email: user.email,
        });
      } catch (dbError) {
        console.error("[Clerk Webhook] Database error:", dbError);
        return new NextResponse("Database error", { status: 500 });
      }
    } else if (eventType === "user.deleted") {
      console.log("[Clerk Webhook] User deleted event received (not processing to preserve referential integrity)");
    } else {
      console.log("[Clerk Webhook] Unhandled event type:", eventType);
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Clerk Webhook] Unexpected error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

