import { describe, expect, it } from "vitest";

import { sanitizeRichText } from "@/lib/text/sanitize-html";

/**
 * The stored-XSS fix.
 *
 * The case study player rendered author-written HTML straight into
 * `dangerouslySetInnerHTML`, so a Course author could run script in every
 * enrolled learner's browser. Each payload below is written the way an attacker
 * would write it, not the way a sanitizer author would.
 */
describe("script execution", () => {
  it.each([
    ["a plain script tag", "<script>alert(1)</script>"],
    ["a script with attributes", '<script type="text/javascript">alert(1)</script>'],
    ["an image error handler", '<img src=x onerror="alert(1)">'],
    ["an svg load handler", "<svg onload=alert(1)>"],
    ["a body handler", "<body onload=alert(1)>"],
    ["an iframe", '<iframe src="https://evil.test"></iframe>'],
    ["an object", '<object data="evil.swf"></object>'],
    ["an embed", '<embed src="evil.swf">'],
    ["a form that posts elsewhere", '<form action="https://evil.test"><input name="a"></form>'],
    ["a meta refresh", '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
    ["a style block", "<style>body{display:none}</style>"],
    ["an inline event on an allowed tag", '<p onclick="alert(1)">click</p>'],
    ["an inline style on an allowed tag", '<p style="position:fixed;inset:0">cover</p>'],
  ])("removes %s", (_label, payload) => {
    const clean = sanitizeRichText(payload);

    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onerror|onload|onclick/i);
    expect(clean).not.toMatch(/<iframe|<object|<embed|<form|<meta|<style|<svg/i);
    expect(clean).not.toMatch(/\sstyle=/i);
  });

  it("does not leave a stripped script's body behind as visible text", () => {
    // `disallowedTagsMode: discard` alone keeps the text content; the payload
    // would still be readable on the page even though it no longer runs.
    expect(sanitizeRichText("<script>alert(1)</script>")).toBe("");
  });
});

describe("link schemes", () => {
  it.each([
    ["javascript:", '<a href="javascript:alert(1)">x</a>'],
    ["uppercase JavaScript:", '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ["a data URL", '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ["vbscript:", '<a href="vbscript:msgbox(1)">x</a>'],
  ])("drops an href using %s", (_label, payload) => {
    expect(sanitizeRichText(payload)).not.toMatch(/javascript:|data:|vbscript:/i);
  });

  it("keeps ordinary links and makes them safe to open", () => {
    const clean = sanitizeRichText('<a href="https://example.test">docs</a>');

    expect(clean).toContain('href="https://example.test"');
    // Without rel, a target-opened link can reach back through window.opener.
    expect(clean).toContain("noopener");
    expect(clean).toContain("noreferrer");
  });

  it("keeps mailto links", () => {
    expect(sanitizeRichText('<a href="mailto:a@example.test">mail</a>')).toContain("mailto:");
  });
});

describe("the formatting authors actually use", () => {
  it("preserves the Quill toolbar's output", () => {
    const authored =
      "<h2>Consent</h2><p><strong>Bold</strong> and <em>italic</em> and <u>underlined</u>.</p>" +
      "<ul><li>one</li><li>two</li></ul><blockquote>quoted</blockquote>";

    expect(sanitizeRichText(authored)).toBe(authored);
  });

  it("preserves the classes Quill uses for indentation and alignment", () => {
    const authored = '<p class="ql-align-center ql-indent-1">centred</p>';

    expect(sanitizeRichText(authored)).toBe(authored);
  });

  it("keeps text that merely looks like markup", () => {
    // A sanitizer that mangles "n < 30" in an ethics case study is a bug of a
    // different kind.
    expect(sanitizeRichText("<p>where n &lt; 30 and x &gt; y</p>")).toContain("&lt;");
  });

  it("returns an empty string for absent input", () => {
    expect(sanitizeRichText("")).toBe("");
    expect(sanitizeRichText(null)).toBe("");
    expect(sanitizeRichText(undefined)).toBe("");
  });
});

describe("evasion attempts", () => {
  it("is not fooled by a tag split across a removed tag", () => {
    expect(sanitizeRichText("<<script>script>alert(1)<</script>/script>")).not.toMatch(/<script/i);
  });

  it("is not fooled by an unterminated tag", () => {
    expect(sanitizeRichText("<script")).not.toMatch(/<script/i);
  });

  it("is idempotent, so re-sanitizing stored output changes nothing", () => {
    // Reads sanitize as well as writes, so a value is processed more than once.
    const once = sanitizeRichText('<p>hi <a href="https://example.test">x</a></p>');

    expect(sanitizeRichText(once)).toBe(once);
  });
});
