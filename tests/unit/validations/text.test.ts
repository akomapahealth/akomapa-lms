import { describe, expect, it } from "vitest";

import { TEXT } from "@/lib/http/limits";
import {
  colorToken,
  httpUrl,
  optionalRichText,
  requiredShortText,
  richText,
  shortText,
  title,
} from "@/lib/validations/text";

describe("title", () => {
  it("trims before measuring, so padded input is stored clean", () => {
    expect(title.parse("  Ethics  ")).toBe("Ethics");
  });

  it("refuses whitespace only", () => {
    // Otherwise a blank title is stored and renders as an empty heading.
    for (const value of ["", " ", "\t\n  "]) {
      expect(title.safeParse(value).success).toBe(false);
    }
  });

  it("accepts the limit and refuses one past it", () => {
    expect(title.safeParse("x".repeat(TEXT.title)).success).toBe(true);
    expect(title.safeParse("x".repeat(TEXT.title + 1)).success).toBe(false);
  });

  it("refuses non-strings", () => {
    for (const value of [1, true, null, undefined, {}, []]) {
      expect(title.safeParse(value).success).toBe(false);
    }
  });
});

describe("shortText and requiredShortText", () => {
  it("allows empty only where the field is optional in meaning", () => {
    expect(shortText.safeParse("").success).toBe(true);
    expect(requiredShortText.safeParse("").success).toBe(false);
  });

  it("bounds both at the short limit", () => {
    expect(shortText.safeParse("x".repeat(TEXT.short + 1)).success).toBe(false);
    expect(requiredShortText.safeParse("x".repeat(TEXT.short + 1)).success).toBe(false);
  });
});

describe("richText", () => {
  it("does not trim, because leading markup is meaningful", () => {
    expect(richText.parse("  <p>hi</p>")).toBe("  <p>hi</p>");
  });

  it("requires content but allows empty when optional", () => {
    expect(richText.safeParse("").success).toBe(false);
    expect(optionalRichText.safeParse("").success).toBe(true);
  });

  it("bounds the size", () => {
    expect(richText.safeParse("x".repeat(TEXT.rich)).success).toBe(true);
    expect(richText.safeParse("x".repeat(TEXT.rich + 1)).success).toBe(false);
  });
});

describe("httpUrl", () => {
  it.each(["https://example.com/a.pdf", "http://example.com", "https://example.com:8443/x?y=1"])(
    "accepts %s",
    (value) => {
      expect(httpUrl.safeParse(value).success).toBe(true);
    }
  );

  it.each([
    ["javascript:alert(1)", "becomes an injection in an href"],
    ["data:text/html,<script>alert(1)</script>", "same"],
    ["file:///etc/passwd", "a local path the server might fetch"],
    ["ftp://example.com/x", "not a scheme this app fetches"],
  ])("refuses %s", (value) => {
    // `z.string().url()` accepts all of these. Attachment URLs are rendered as
    // hrefs and video URLs are handed to Mux to fetch.
    expect(httpUrl.safeParse(value).success).toBe(false);
  });

  it.each(["not a url", "", "example.com", "//example.com"])("refuses %s", (value) => {
    expect(httpUrl.safeParse(value).success).toBe(false);
  });

  it("bounds the length", () => {
    expect(httpUrl.safeParse(`https://e.com/${"x".repeat(TEXT.url)}`).success).toBe(false);
  });
});

describe("colorToken", () => {
  it.each(["#fff", "#ff0000", "#ff0000ff", "red", "rebeccapurple"])("accepts %s", (value) => {
    expect(colorToken.safeParse(value).success).toBe(true);
  });

  it.each(["#ff", "rgb(1,2,3)", "red; background:url(x)", "<script>", "#gggggg"])(
    "refuses %s",
    (value) => {
      expect(colorToken.safeParse(value).success).toBe(false);
    }
  );
});
