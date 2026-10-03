import { z } from "zod";

import { TopicContentType } from "@/lib/domain/states";

import { resourceId } from "./ids";
import { httpUrl, optionalRichText, shortText, title } from "./text";

/**
 * Topic bodies (#44). `Chapter` is the legacy route and storage term; the domain
 * term is Topic (CONTEXT.md).
 */
export const topicCreateSchema = z.object({ title }).strict();

export const topicUpdateSchema = z
  .object({
    title: title.optional(),
    description: shortText.optional().nullable(),
    // Handed to Mux as an asset input, so it must be a real http(s) URL.
    videoUrl: httpUrl.optional().nullable(),
    textContent: optionalRichText.optional().nullable(),
    contentType: z.nativeEnum(TopicContentType).optional(),
    isFree: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });

/** Progress writes. The value drives Enrollment status and certificate issuance. */
export const progressSchema = z.object({ isCompleted: z.boolean() }).strict();

/** The Module a Topic may be moved into, where supported. */
export const moduleRef = resourceId;
