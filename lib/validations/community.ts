import { z } from "zod";

import { TEXT } from "@/lib/http/limits";

import { resourceId } from "./ids";
import { colorToken, richText, shortText, title } from "./text";

/**
 * Community bodies (#44).
 *
 * `.strict()` everywhere. A create route that spread `await req.json()` into
 * Prisma would accept any column name the model happens to have; rejecting
 * unknown keys is what stops a caller from setting `isPinned` on their own post.
 */

export const postCreateSchema = z
  .object({
    title,
    content: richText,
    categoryId: resourceId,
    // Optional association with a Course. Null and absent both mean "none".
    courseId: resourceId.nullish(),
  })
  .strict();

export const postUpdateSchema = z
  .object({
    title: title.optional(),
    content: richText.optional(),
    categoryId: resourceId.optional(),
  })
  .strict()
  // An empty PATCH is a client bug, and answering 422 says so rather than
  // performing a no-op write and reporting success.
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });

export const commentCreateSchema = z
  .object({
    content: richText,
    /** Replying to a top-level comment. Depth beyond 2 is refused by the route. */
    parentId: resourceId.nullish(),
  })
  .strict();

export const commentUpdateSchema = z
  .object({ content: richText })
  .strict();

export const categoryCreateSchema = z
  .object({
    name: title,
    description: shortText.optional(),
    color: colorToken.optional(),
    position: z.number().int().min(0).max(TEXT.title).optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    name: title.optional(),
    description: shortText.optional(),
    color: colorToken.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });
