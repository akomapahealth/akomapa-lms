import { describe, expect, it } from "vitest";

import {
  ApiError,
  CORRELATION_HEADER,
  ERROR_CODES,
  isApiError,
  newCorrelationId,
  problem,
  problemBody,
  statusFor,
  type ErrorCode,
} from "@/lib/http/problem";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ALL_CODES = Object.keys(ERROR_CODES) as ErrorCode[];

/**
 * The response contract in docs/api-errors.md. These tests are the reason a
 * client may branch on `error.code`: if a code's status ever changes silently,
 * every caller's error handling changes with it.
 */
describe("ERROR_CODES", () => {
  it("maps every code to the status the contract documents", () => {
    expect(ERROR_CODES).toEqual({
      unauthenticated: 401,
      forbidden: 403,
      not_found: 404,
      invalid_parameter: 400,
      malformed_json: 400,
      validation_failed: 422,
      conflict: 409,
      payload_too_large: 413,
      unsupported_media_type: 415,
      rate_limited: 429,
      internal: 500,
    });
  });

  it("uses only statuses the issue requires", () => {
    // #44 names 400/401/403/404/409/422/429; 413, 415, and 500 complete the set.
    for (const status of Object.values(ERROR_CODES)) {
      expect([400, 401, 403, 404, 409, 413, 415, 422, 429, 500]).toContain(status);
    }
  });
});

describe("statusFor", () => {
  it.each(ALL_CODES)("resolves %s", (code) => {
    expect(statusFor(code)).toBe(ERROR_CODES[code]);
  });
});

describe("newCorrelationId", () => {
  it("is a uuid, and a different one each time", () => {
    const first = newCorrelationId();
    const second = newCorrelationId();

    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(first).not.toBe(second);
  });
});

describe("problemBody", () => {
  it.each(ALL_CODES)("gives %s a non-empty default message", (code) => {
    const body = problemBody(code);

    expect(body.error.code).toBe(code);
    expect(body.error.message.length).toBeGreaterThan(0);
    expect(body.error.correlationId).toMatch(UUID);
  });

  it("omits `fields` rather than sending an empty array", () => {
    // An empty array reads as "no field was at fault", which is a different
    // claim from "this failure is not field-level".
    expect(problemBody("internal").error.fields).toBeUndefined();
    expect(problemBody("validation_failed", { fields: [] }).error.fields).toBeUndefined();
  });

  it("carries field problems when there are some", () => {
    const fields = [{ path: "answers.0.questionId", code: "invalid_string" }];

    expect(problemBody("validation_failed", { fields }).error.fields).toEqual(fields);
  });

  it("accepts an overriding message and correlation id", () => {
    const body = problemBody("conflict", {
      message: "Already submitted.",
      correlationId: "fixed-id",
    });

    expect(body.error.message).toBe("Already submitted.");
    expect(body.error.correlationId).toBe("fixed-id");
  });

  it("never embeds a stack, a schema, or a submitted value", () => {
    // The whole point of the shape: a caller learns which field and what kind of
    // failure, and nothing about how the server is built.
    const serialised = JSON.stringify(
      problemBody("validation_failed", { fields: [{ path: "title", code: "too_big" }] })
    );

    expect(serialised).not.toMatch(/at \w+ \(/);
    expect(serialised).not.toContain("ZodError");
    expect(serialised).not.toContain("prisma");
  });
});

describe("problem", () => {
  it("answers with the code's status and the body shape", async () => {
    const response = problem("payload_too_large");

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error.code).toBe("payload_too_large");
  });

  it("repeats the correlation id in a header", async () => {
    const response = problem("internal");
    const body = await response.json();

    expect(response.headers.get(CORRELATION_HEADER)).toBe(body.error.correlationId);
  });

  it("honours a supplied correlation id in both places", async () => {
    // This is what ties a 500's response to the log line written for it.
    const response = problem("internal", { correlationId: "abc-123" });

    expect(response.headers.get(CORRELATION_HEADER)).toBe("abc-123");
    await expect(response.json()).resolves.toMatchObject({
      error: { correlationId: "abc-123" },
    });
  });
});

describe("ApiError", () => {
  it("carries the code, the fields, and a correlation id", () => {
    const fields = [{ path: "list", code: "too_big" }];
    const error = new ApiError("validation_failed", { fields });

    expect(error.code).toBe("validation_failed");
    expect(error.fields).toEqual(fields);
    expect(error.correlationId).toMatch(UUID);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
  });

  it("names only the code in its message by default", () => {
    // The message reaches logs. It must not carry the offending value.
    expect(new ApiError("malformed_json").message).toBe("api error: malformed_json");
  });

  it("accepts an explicit message and correlation id", () => {
    const error = new ApiError("conflict", { message: "locked", correlationId: "cid" });

    expect(error.message).toBe("locked");
    expect(error.correlationId).toBe("cid");
  });

  it("is recognised by isApiError, and nothing else is", () => {
    expect(isApiError(new ApiError("internal"))).toBe(true);
    for (const other of [new Error("boom"), null, undefined, "internal", {}, { code: "internal" }]) {
      expect(isApiError(other)).toBe(false);
    }
  });
});
