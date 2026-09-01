/**
 * Reduces rich text to a plain-text excerpt.
 *
 * This is **not** a sanitizer and must never be used to produce HTML. It exists
 * to make previews and list summaries out of stored rich text, and its output
 * belongs in a JSX text node, where React escapes it.
 *
 * Two copies of a one-line version of this lived in the codebase, each doing a
 * single `replace(/<[^>]*>/g, "")`. One pass is not enough:
 *
 *   - `<<div>script>` leaves `<script>` behind, because removing the inner tag
 *     re-forms a tag out of the characters either side of it.
 *   - An unterminated `<script` has no closing `>`, so the pattern never
 *     matches it and it survives verbatim.
 *
 * So the pass repeats until the string stops changing, and any `<` still
 * standing afterwards is removed outright. Nothing that could open a tag
 * survives, which is what makes the result safe to treat as text.
 *
 * Rendering stored rich text *as HTML* is a different problem with a different
 * answer -- a real sanitizer with an allow-list -- and belongs to
 * [#81](https://github.com/akomapahealth/akomapa-lms/issues/81).
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  let current = html;
  let previous: string;

  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, "");
  } while (current !== previous);

  return current
    // Anything left that could still begin a tag.
    .replace(/</g, "")
    // The entity a rich-text editor emits most often; without this, excerpts
    // read as "one&nbsp;two".
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A plain-text excerpt of at most `length` characters. */
export function excerpt(html: string, length: number): string {
  return stripHtml(html).slice(0, length);
}
