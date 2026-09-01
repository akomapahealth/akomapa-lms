import "server-only";

import sanitize from "sanitize-html";

/**
 * Sanitizes stored rich text before it is rendered as HTML.
 *
 * The case study player rendered `scenario.introduction`,
 * `scenario.conclusion`, and each step's `narrative` straight into
 * `dangerouslySetInnerHTML` with nothing in between. A Course author could
 * therefore run script in every enrolled learner's browser. Authoring is
 * restricted to the Course's own faculty (#42), so this is not anonymous, but
 * a Course author is not a trusted operator either -- and stored XSS persists
 * until someone notices.
 *
 * Marked `server-only` on purpose. Sanitizing in the browser would still ship
 * the unsafe markup to it first; doing it here means the raw string never
 * leaves the server. Everything that renders stored rich text should pass
 * through this on the server side of the boundary.
 *
 * Owned by [#81](https://github.com/akomapahealth/akomapa-lms/issues/81).
 */

/**
 * What the editor can actually produce.
 *
 * The allow-list is deliberately smaller than "the safe subset of HTML": it
 * matches the formats the Quill toolbar offers, so anything else in a stored
 * value arrived from somewhere other than the editor and has no reason to be
 * preserved. Adding a format to the editor means adding it here.
 */
const ALLOWED_TAGS = [
  "p", "br", "span", "strong", "em", "u", "s", "blockquote",
  "ol", "ul", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "code", "pre", "sub", "sup",
];

export const RICH_TEXT_POLICY: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    // Quill emits indentation and alignment as classes.
    "*": ["class"],
  },
  // No `javascript:`, no `data:`. A data: URL on an anchor is a navigation
  // primitive that can carry markup.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  // Discard the contents of anything script-like rather than keeping its text,
  // so a stripped `<script>` cannot leave its body behind as visible garbage.
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  transformTags: {
    // Any surviving link leaves the application, so it must not be able to
    // reach back through window.opener.
    a: sanitize.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
  },
  disallowedTagsMode: "discard",
};

/** Sanitizes one rich-text field. Returns an empty string for absent input. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitize(html, RICH_TEXT_POLICY);
}
