import { z } from "zod";

import { httpUrl } from "./text";

/**
 * Attachment creation (#44).
 *
 * The handler derived the stored name with `url.split("/").pop()`, which on an
 * unvalidated body could be `undefined` (a URL ending in `/`) and was written to
 * a non-null column. Requiring a real http(s) URL and deriving the name safely
 * removes both the crash and the `javascript:` href that the bare
 * `z.string().url()` would have allowed through.
 */
export const attachmentCreateSchema = z.object({ url: httpUrl }).strict();

/**
 * The display name for a stored attachment URL.
 *
 * Falls back to the host when the path has no final segment, so the column is
 * never written empty.
 */
export function attachmentNameFrom(url: string): string {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter((part) => part.length > 0);
  const last = segments[segments.length - 1];
  return last !== undefined ? decodeURIComponent(last) : parsed.host;
}
