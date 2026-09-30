import { z } from "zod";

import { NUMBER } from "@/lib/http/limits";

import { resourceId } from "./ids";
import { httpUrl, shortText, title } from "./text";

/**
 * Course bodies (#44).
 *
 * `price` is still a float here because the column is; #55 replaces it with an
 * exact money representation. Until then it is at least bounded, finite, and
 * non-negative, which the bare `z.number().min(0)` was not: `Infinity` and
 * `NaN` both passed it, and `Infinity` reached `Math.round(price * 100)` in the
 * checkout route.
 */
export const courseCreateSchema = z.object({ title }).strict();

export const courseUpdateSchema = z
  .object({
    title: title.optional(),
    description: shortText.optional(),
    imageUrl: httpUrl.optional().nullable(),
    price: z
      .number()
      .finite()
      .min(0)
      .max(NUMBER.maxPrice)
      .optional()
      .nullable(),
    categoryId: resourceId.optional().nullable(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });
