import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isApiError, type ApiError } from "@/lib/http/problem";
import { parseBody, parseParams, parseQuery, toFieldProblems } from "@/lib/http/validate";

/** The ApiError a call throws, for asserting on code and fields together. */
async function thrown(run: () => unknown | Promise<unknown>): Promise<ApiError> {
  try {
    await run();
  } catch (error) {
    if (isApiError(error)) return error;
    throw error;
  }
  throw new Error("expected the call to throw");
}

const UUID_A = "11111111-1111-4111-8111-111111111111";

describe("toFieldProblems", () => {
  it("reports a dotted path and the issue code", () => {
    const schema = z.object({ answers: z.array(z.object({ id: z.string().uuid() })) });
    const result = schema.safeParse({ answers: [{ id: "nope" }] });

    expect(result.success).toBe(false);
    expect(toFieldProblems(result.error!)).toEqual([
      { path: "answers.0.id", code: "invalid_string" },
    ]);
  });

  it("names the refused keys for an unknown-field failure", () => {
    // `unrecognized_keys` is reported against the parent, so the path alone
    // would not say which key was refused. The keys are the caller's own input.
    const result = z.object({ a: z.string() }).strict().safeParse({ a: "x", isPinned: true });

    expect(toFieldProblems(result.error!)).toEqual([
      { path: "isPinned", code: "unrecognized_keys" },
    ]);
  });

  it("prefixes refused keys with the parent path when nested", () => {
    const schema = z.object({ inner: z.object({ a: z.string() }).strict() });
    const result = schema.safeParse({ inner: { a: "x", b: 1 } });

    expect(toFieldProblems(result.error!)).toEqual([
      { path: "inner.b", code: "unrecognized_keys" },
    ]);
  });

  it("never carries zod's message, which quotes the schema and the value", () => {
    // zod says things like "Invalid enum value. Expected 'PRE_TEST' | ...,
    // received 'x'", which describes the schema to whoever is probing it.
    const result = z.object({ type: z.enum(["PRE_TEST", "POST_TEST"]) }).safeParse({
      type: "SNEAKY_VALUE",
    });

    const serialised = JSON.stringify(toFieldProblems(result.error!));
    expect(serialised).not.toContain("SNEAKY_VALUE");
    expect(serialised).not.toContain("PRE_TEST");
  });

  it("reports every failing field, not just the first", () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    const result = schema.safeParse({ a: 1, b: "x" });

    expect(toFieldProblems(result.error!)).toHaveLength(2);
  });
});

describe("parseParams", () => {
  const schema = z.object({ courseId: z.string().uuid() }).strict();

  it("returns the parsed params", () => {
    expect(parseParams(schema, { courseId: UUID_A })).toEqual({ courseId: UUID_A });
  });

  it("rejects a non-uuid segment as invalid_parameter, not validation_failed", async () => {
    // The address is wrong, not the payload. 400, and it keeps a garbage id out
    // of a database query.
    const error = await thrown(() => parseParams(schema, { courseId: "../../etc/passwd" }));

    expect(error.code).toBe("invalid_parameter");
    expect(error.fields).toEqual([{ path: "courseId", code: "invalid_string" }]);
  });

  it.each([
    ["missing", {}],
    ["null", { courseId: null }],
    ["numeric", { courseId: 7 }],
    ["a uuid-shaped prefix", { courseId: `${UUID_A}-extra` }],
    ["an empty string", { courseId: "" }],
  ])("rejects %s", async (_label, raw) => {
    expect((await thrown(() => parseParams(schema, raw))).code).toBe("invalid_parameter");
  });

  it("rejects an extra segment, which means handler and schema have drifted", async () => {
    expect(
      (await thrown(() => parseParams(schema, { courseId: UUID_A, quizId: UUID_A }))).code
    ).toBe("invalid_parameter");
  });
});

describe("parseQuery", () => {
  const schema = z.object({ page: z.coerce.number().int().min(1).max(100) }).strict();

  it("parses and coerces query values", () => {
    expect(parseQuery(schema, "http://localhost/x?page=3")).toEqual({ page: 3 });
  });

  it("rejects an out-of-range value", async () => {
    expect((await thrown(() => parseQuery(schema, "http://localhost/x?page=0"))).code).toBe(
      "invalid_parameter"
    );
  });

  it("keeps the last value of a repeated key", () => {
    // Documented behaviour: a route meaning to accept repeats must read getAll.
    expect(parseQuery(schema, "http://localhost/x?page=1&page=9")).toEqual({ page: 9 });
  });
});

describe("parseBody", () => {
  const schema = z
    .object({ title: z.string().min(1).max(10), count: z.number().int().optional() })
    .strict();

  function request(body: unknown, contentType = "application/json") {
    return new Request("http://localhost/x", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": contentType },
    });
  }

  it("returns the parsed body", async () => {
    await expect(parseBody(schema, request({ title: "ok" }))).resolves.toEqual({
      title: "ok",
    });
  });

  it("answers validation_failed for a schema failure", async () => {
    const error = await thrown(() => parseBody(schema, request({ title: "" })));

    expect(error.code).toBe("validation_failed");
    expect(error.fields).toEqual([{ path: "title", code: "too_small" }]);
  });

  it("rejects an unknown field", async () => {
    // A create route that spread the body into Prisma would accept any column
    // the model happens to have.
    const error = await thrown(() =>
      parseBody(schema, request({ title: "ok", isAdmin: true }))
    );

    expect(error.code).toBe("validation_failed");
    expect(error.fields).toEqual([{ path: "isAdmin", code: "unrecognized_keys" }]);
  });

  it("rejects a value past its bound", async () => {
    const error = await thrown(() => parseBody(schema, request({ title: "x".repeat(11) })));

    expect(error.fields).toEqual([{ path: "title", code: "too_big" }]);
  });

  it("answers malformed_json before it answers validation_failed", async () => {
    // Order matters: an unparseable body has no fields to report on.
    expect((await thrown(() => parseBody(schema, request("{oops")))).code).toBe(
      "malformed_json"
    );
  });

  it("answers unsupported_media_type before reading the body at all", async () => {
    expect(
      (await thrown(() => parseBody(schema, request({ title: "ok" }, "text/plain")))).code
    ).toBe("unsupported_media_type");
  });

  it("defaults to the smallest body limit", async () => {
    // A route carrying rich text must raise the ceiling deliberately, so the
    // generous limits apply only where someone decided they should.
    const big = { title: "ok", count: 1, pad: "x".repeat(20 * 1024) };

    expect((await thrown(() => parseBody(schema, request(big)))).code).toBe(
      "payload_too_large"
    );
  });

  it("honours an explicit larger limit", async () => {
    const richSchema = z.object({ content: z.string() }).strict();
    const body = { content: "x".repeat(20 * 1024) };

    await expect(parseBody(richSchema, request(body), 64 * 1024)).resolves.toEqual(body);
  });

  it("rejects a JSON array or scalar where an object is required", async () => {
    for (const body of ["[]", "42", '"str"', "null", "true"]) {
      expect((await thrown(() => parseBody(schema, request(body)))).code).toBe(
        "validation_failed"
      );
    }
  });
});
