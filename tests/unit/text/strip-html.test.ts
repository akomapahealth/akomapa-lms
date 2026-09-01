import { describe, expect, it } from "vitest";

import { excerpt, stripHtml } from "@/lib/text/strip-html";

/**
 * The cases that made the previous single-pass version wrong.
 *
 * CodeQL flagged four call sites for `js/incomplete-multi-character-sanitization`.
 * The output goes into JSX text nodes, where React escapes it, so nothing was
 * exploitable -- but "safe because of where it happens to be rendered" is not a
 * property worth relying on, and the next caller may not render it that way.
 */
describe("stripHtml", () => {
  it("removes ordinary tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("neutralises a tag re-formed by removing the tag inside it", () => {
    // One pass over `<<div>script>alert(1)` consumes `<<div>` and leaves
    // `script>alert(1)`. What remains is inert text -- the point is that no `<`
    // survives to open a tag, not that every character disappears.
    const result = stripHtml("<<div>script>alert(1)");

    expect(result).toBe("script>alert(1)");
    expect(result).not.toContain("<");
  });

  it("neutralises an unterminated tag, which no `<[^>]*>` pattern can match", () => {
    // `<script` has no closing `>`, so the pattern never matches it. The old
    // version returned it verbatim, which is what CodeQL flagged.
    expect(stripHtml("<script")).toBe("script");
    expect(stripHtml("hello <script")).toBe("hello script");
  });

  it("leaves nothing that could open a tag", () => {
    for (const input of [
      "<script>alert(1)</script>",
      "<<script>script>alert(1)",
      "<img src=x onerror=alert(1)>",
      "<<<>>>",
      "a < b",
    ]) {
      expect(stripHtml(input)).not.toContain("<");
    }
  });

  it("decodes the non-breaking space a rich-text editor emits", () => {
    expect(stripHtml("<p>one&nbsp;two</p>")).toBe("one two");
  });

  it("collapses whitespace so a preview reads as one line", () => {
    expect(stripHtml("<p>one</p>\n\n<p>two</p>")).toBe("one two");
  });

  it("handles empty and absent input", () => {
    expect(stripHtml("")).toBe("");
    expect(stripHtml(undefined as unknown as string)).toBe("");
  });

  it("leaves plain text alone", () => {
    expect(stripHtml("Just a sentence.")).toBe("Just a sentence.");
  });
});

describe("excerpt", () => {
  it("truncates after stripping, not before", () => {
    // Truncating first can cut a tag in half and leave `<scr` in the output.
    const html = `<p>${"a".repeat(200)}</p>`;

    expect(excerpt(html, 10)).toBe("a".repeat(10));
  });

  it("returns the whole string when it is shorter than the limit", () => {
    expect(excerpt("<p>short</p>", 150)).toBe("short");
  });
});
