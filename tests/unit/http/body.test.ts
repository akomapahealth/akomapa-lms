import { describe, expect, it } from "vitest";

import { readBoundedText, readJson } from "@/lib/http/body";
import { isApiError } from "@/lib/http/problem";

/** The code an ApiError thrown by the call under test carries. */
async function codeFrom(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (isApiError(error)) return error.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

function jsonRequest(body: string | Uint8Array, contentType = "application/json") {
  return new Request("http://localhost/x", {
    method: "POST",
    // A Uint8Array is a valid BodyInit at runtime; the DOM lib types it via
    // ArrayBufferView, which the union above does not narrow to on its own.
    body: body as BodyInit,
    headers: { "content-type": contentType },
  });
}

/**
 * Reading a body without trusting its size or its encoding.
 *
 * `await req.json()` -- what every handler did before #44 -- buffers the whole
 * body before discovering it is too large, and reports a parse failure the same
 * way it reports a network fault.
 */
describe("readBoundedText", () => {
  it("returns a body inside the limit", async () => {
    await expect(readBoundedText(jsonRequest("hello"), 1024)).resolves.toBe("hello");
  });

  it("accepts a body exactly at the limit", async () => {
    // Off-by-one at a security boundary is worth pinning: the limit is inclusive.
    await expect(readBoundedText(jsonRequest("12345"), 5)).resolves.toBe("12345");
  });

  it("rejects one byte over the limit", async () => {
    expect(await codeFrom(() => readBoundedText(jsonRequest("123456"), 5))).toBe(
      "payload_too_large"
    );
  });

  it("rejects on a Content-Length that exceeds the limit, before reading", async () => {
    // The cheap rejection. A lying or absent header is caught by the stream count.
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: "small",
      headers: { "content-type": "application/json", "content-length": "999999" },
    });

    expect(await codeFrom(() => readBoundedText(request, 10))).toBe("payload_too_large");
  });

  it("enforces the limit even when Content-Length understates the body", async () => {
    // The header is a client claim. The streaming count is the enforcement.
    const request = jsonRequest("x".repeat(500));
    Object.defineProperty(request, "headers", {
      value: new Headers({ "content-type": "application/json", "content-length": "1" }),
    });

    expect(await codeFrom(() => readBoundedText(request, 100))).toBe("payload_too_large");
  });

  it("counts bytes, not characters", async () => {
    // A 4-byte emoji is one JS character. Measuring `String.length` would let a
    // caller send four times the intended limit.
    const fourBytes = "\u{1F600}";

    await expect(readBoundedText(jsonRequest(fourBytes), 4)).resolves.toBe(fourBytes);
    expect(await codeFrom(() => readBoundedText(jsonRequest(fourBytes), 3))).toBe(
      "payload_too_large"
    );
  });

  it("reassembles a body that arrives in several chunks", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("abc"));
        controller.enqueue(new TextEncoder().encode("def"));
        controller.close();
      },
    });
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: stream,
      headers: { "content-type": "application/json" },
      // @ts-expect-error -- undici requires this for a stream body.
      duplex: "half",
    });

    await expect(readBoundedText(request, 1024)).resolves.toBe("abcdef");
  });

  it("handles a request with no body stream", async () => {
    const request = new Request("http://localhost/x", { method: "POST" });

    await expect(readBoundedText(request, 1024)).resolves.toBe("");
  });

  it("still enforces the limit when there is no stream to meter", async () => {
    // A runtime (or a test double) can expose a body through `text()` with
    // `body` null. The fallback path has to bound it too, or the limit depends on
    // an implementation detail of whoever built the Request.
    const stub = {
      headers: new Headers({ "content-type": "application/json" }),
      body: null,
      text: async () => "x".repeat(200),
    } as unknown as Request;

    expect(await codeFrom(() => readBoundedText(stub, 10))).toBe("payload_too_large");
  });

  it("skips an empty chunk without ending the read", async () => {
    // Defensive: a byte stream should not yield `undefined`, but a stream is an
    // interface anyone can implement, and treating it as end-of-body would
    // silently truncate the request.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("a"));
        controller.enqueue(undefined as unknown as Uint8Array);
        controller.enqueue(new TextEncoder().encode("b"));
        controller.close();
      },
    });
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: stream,
      headers: { "content-type": "application/json" },
      // @ts-expect-error -- undici requires this for a stream body.
      duplex: "half",
    });

    await expect(readBoundedText(request, 1024)).resolves.toBe("ab");
  });

  it("rejects malformed UTF-8 rather than storing replacement characters", async () => {
    // A lone continuation byte. Decoding non-fatally would turn it into U+FFFD
    // and store it.
    expect(
      await codeFrom(() => readBoundedText(jsonRequest(new Uint8Array([0x80])), 10))
    ).toBe("malformed_json");
  });
});

describe("readJson", () => {
  it("parses a valid JSON body", async () => {
    await expect(readJson(jsonRequest('{"a":1}'), 1024)).resolves.toEqual({ a: 1 });
  });

  it("accepts a structured-suffix JSON type", async () => {
    await expect(
      readJson(jsonRequest("{}", "application/merge-patch+json"), 1024)
    ).resolves.toEqual({});
  });

  it("ignores Content-Type parameters and casing", async () => {
    await expect(
      readJson(jsonRequest("{}", "Application/JSON; charset=utf-8"), 1024)
    ).resolves.toEqual({});
  });

  it.each([
    ["text/plain", "a plain-text body"],
    ["application/x-www-form-urlencoded", "a form post"],
    ["multipart/form-data", "a multipart form"],
  ])("refuses %s", async (contentType) => {
    // Guessing that an undeclared body is JSON is what lets a simple
    // cross-origin form reach a JSON parser; #45 builds on the declared type.
    expect(await codeFrom(() => readJson(jsonRequest("{}", contentType), 1024))).toBe(
      "unsupported_media_type"
    );
  });

  it("refuses a Content-Type that is present but empty", async () => {
    // `"; charset=utf-8"` has a parameter and no media type. Treating the empty
    // string as a type would compare it against the JSON set and fall through.
    for (const header of ["", "  ", "; charset=utf-8"]) {
      const request = jsonRequest("{}");
      Object.defineProperty(request, "headers", {
        value: new Headers({ "content-type": header }),
      });

      expect(await codeFrom(() => readJson(request, 1024))).toBe("unsupported_media_type");
    }
  });

  it("refuses a missing Content-Type", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: "{}" });
    // undici infers text/plain for a string body, so strip it to test absence.
    Object.defineProperty(request, "headers", { value: new Headers() });

    expect(await codeFrom(() => readJson(request, 1024))).toBe("unsupported_media_type");
  });

  it.each([
    ["truncated object", "{"],
    ["trailing comma", '{"a":1,}'],
    ["single quotes", "{'a':1}"],
    ["bare word", "undefined"],
    ["empty body", ""],
    ["whitespace only", "   \n  "],
  ])("refuses %s as malformed", async (_label, body) => {
    expect(await codeFrom(() => readJson(jsonRequest(body), 1024))).toBe("malformed_json");
  });

  it("never leaks the parser's message, which quotes the input", async () => {
    // `JSON.parse` reports the offending token and its position.
    const secret = "s3cret-token-value";

    try {
      await readJson(jsonRequest(`{"a": ${secret}}`), 1024);
      throw new Error("expected a throw");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("applies the size limit before parsing", async () => {
    // Parsing first would mean a 50MB body is fully materialised as objects.
    expect(await codeFrom(() => readJson(jsonRequest('{"a":"' + "x".repeat(200) + '"}'), 50))).toBe(
      "payload_too_large"
    );
  });

  it("passes through a JSON scalar, leaving the shape to a schema", async () => {
    // `readJson` returns `unknown` on purpose; bounding is its job, not shaping.
    await expect(readJson(jsonRequest("42"), 1024)).resolves.toBe(42);
    await expect(readJson(jsonRequest("null"), 1024)).resolves.toBeNull();
  });
});
