import { z } from "zod";

import { TEXT } from "@/lib/http/limits";

import { clerkUserId, resourceId } from "./ids";

/**
 * External webhook envelopes (#44).
 *
 * A verified signature proves the message came from the provider. It does not
 * prove the fields inside are the ones this code expects: Stripe metadata is
 * whatever was set when the session was created, and a Clerk payload's optional
 * fields are genuinely optional. Both were read with `?.` chains and non-null
 * assertions, so a session created without metadata produced either a row with
 * an empty foreign key or a 500.
 */

/**
 * The metadata `POST /api/courses/[courseId]/checkout` attaches to a session.
 *
 * Both ids are validated on the way back in, not merely checked for presence:
 * the webhook writes a Purchase row from them.
 */
export const checkoutMetadataSchema = z
  .object({
    userId: clerkUserId,
    courseId: resourceId,
  })
  // Not strict: Stripe may add its own keys, and a future feature may attach
  // more metadata without this route needing to know about it.
  .passthrough();

/**
 * The part of a Clerk `user.created` / `user.updated` payload this app stores.
 *
 * Emails are addresses of real people, so they are validated but never logged
 * (policy 01).
 */
export const clerkUserDataSchema = z
  .object({
    id: clerkUserId,
    email_addresses: z
      .array(
        z
          .object({
            id: z.string().min(1).max(TEXT.token),
            email_address: z.string().email().max(TEXT.title),
          })
          .passthrough()
      )
      .optional(),
    primary_email_address_id: z.string().min(1).max(TEXT.token).nullish(),
    first_name: z.string().max(TEXT.title).nullish(),
    last_name: z.string().max(TEXT.title).nullish(),
    image_url: z.string().max(TEXT.url).nullish(),
  })
  .passthrough();

/** The primary address if Clerk names one, otherwise the first on the account. */
export function primaryEmailOf(
  data: z.output<typeof clerkUserDataSchema>
): string | undefined {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find((a) => a.id === data.primary_email_address_id);
  return (primary ?? addresses[0])?.email_address;
}
