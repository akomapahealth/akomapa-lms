import { z } from "zod";

import { TEXT } from "@/lib/http/limits";

/**
 * Bounded text primitives (#44).
 *
 * Every string a client sends gets a ceiling here rather than at each call site,
 * so "how long may a title be" is one decision. `.trim()` runs before the length
 * check, which means a field of pure whitespace fails `min(1)` instead of being
 * stored as a blank title that renders as an empty heading.
 *
 * These bound *size*, not safety. Rich text is sanitized separately on the way
 * to the client (`lib/text/sanitize-html.ts`, `lib/case-study-sanitize.ts`);
 * #81 owns extending that to the surfaces that still render stored markup raw.
 */

/** A required title or name. */
export const title = z.string().trim().min(1).max(TEXT.title);

/** A short free-text field: a description, a question, a choice. */
export const shortText = z.string().trim().max(TEXT.short);

/** A required short free-text field. */
export const requiredShortText = z.string().trim().min(1).max(TEXT.short);

/** Author- or learner-written rich text, stored as HTML. */
export const richText = z.string().min(1).max(TEXT.rich);

/** Optional rich text, where empty means "cleared". */
export const optionalRichText = z.string().max(TEXT.rich);

/**
 * A URL we will store, and later fetch or render.
 *
 * Restricted to http(s): the default `z.string().url()` accepts `javascript:`
 * and `data:`, either of which becomes an injection the moment the value is put
 * in an `href` or handed to a fetcher.
 */
export const httpUrl = z
  .string()
  .trim()
  .max(TEXT.url)
  .url()
  .refine(
    (value) => {
      try {
        const scheme = new URL(value).protocol;
        return scheme === "http:" || scheme === "https:";
      } catch {
        return false;
      }
    },
    { message: "unsupported_scheme" }
  );

/** A CSS colour token for a forum category badge. */
export const colorToken = z
  .string()
  .trim()
  .max(TEXT.token)
  .regex(/^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/, { message: "invalid_color" });
