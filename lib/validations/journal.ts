import { z } from "zod";

import { resourceId } from "./ids";
import { optionalRichText, richText, shortText, title } from "./text";

/**
 * Journal bodies (#44).
 *
 * Journal entries are private by default and treated as sensitive content
 * (policy 01), which is why `isPrivate` is validated as a boolean rather than
 * accepted as any truthy value: `isPrivate: "false"` is a non-empty string, so
 * the previous `isPrivate ?? true` would have stored a public entry the learner
 * believed was private.
 */

export const journalCreateSchema = z
  .object({
    title,
    content: richText,
    isPrivate: z.boolean().optional(),
    prompt: shortText.nullish(),
    moduleId: resourceId.nullish(),
    courseId: resourceId.nullish(),
  })
  .strict();

export const journalUpdateSchema = z
  .object({
    title: title.optional(),
    content: optionalRichText.optional(),
    isPrivate: z.boolean().optional(),
    moduleId: resourceId.nullish(),
    courseId: resourceId.nullish(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });
