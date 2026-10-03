import { z } from "zod";

import { COUNT, NUMBER } from "@/lib/http/limits";

import { resourceId } from "./ids";

/**
 * Reorder payloads (#44).
 *
 * The previous shape was `{ list }` typed as `any`, iterated with one UPDATE per
 * element. Three things were wrong with it: the list was unbounded, so a single
 * request could issue arbitrarily many writes; the ids were unvalidated; and
 * nothing checked that they belonged to the Course or Quiz the caller was
 * authorized for. The schema fixes the first two. The third is a query-scoping
 * fix in the handlers, because no schema can know what a row's parent is.
 */
export const reorderSchema = z
  .object({
    list: z
      .array(
        z
          .object({
            id: resourceId,
            position: z.number().int().min(0).max(NUMBER.maxPosition),
          })
          .strict()
      )
      .min(1)
      .max(COUNT.reorder)
      // A repeated id means the caller is asking for two positions for one row,
      // and the last write would silently win.
      .refine(
        (list) => new Set(list.map((item) => item.id)).size === list.length,
        { message: "duplicate_id" }
      )
      // Two rows asked to share a position would violate the per-parent
      // unique index (#51); refused here so the caller learns why.
      .refine(
        (list) => new Set(list.map((item) => item.position)).size === list.length,
        { message: "duplicate_position" }
      ),
  })
  .strict();
