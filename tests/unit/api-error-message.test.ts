import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { apiErrorMessage, describeWait } from "@/lib/api-error-message";

function axiosFailure(status: number, headers: Record<string, string> = {}, data: unknown = {}) {
  const error = new AxiosError("Request failed", "ERR_BAD_RESPONSE");
  error.response = {
    status,
    statusText: "",
    data,
    headers,
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe("apiErrorMessage", () => {
  it("tells a rate-limited learner how long to wait", () => {
    expect(apiErrorMessage(axiosFailure(429, { "retry-after": "180" }), "Failed")).toBe(
      "You're doing that too often. Please try again in 3 minutes."
    );
  });

  it.each([
    [{}, "no header"],
    [{ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }, "an HTTP-date"],
    [{ "retry-after": "soon" }, "garbage"],
    [{ "retry-after": "0" }, "zero"],
  ])("falls back to a generic wait for %s (%s)", (headers, _label) => {
    expect(apiErrorMessage(axiosFailure(429, headers), "Failed")).toBe(
      "You're doing that too often. Please wait a moment and try again."
    );
  });

  it("explains a temporary outage", () => {
    expect(apiErrorMessage(axiosFailure(503, { "retry-after": "30" }), "Failed")).toBe(
      "This is temporarily unavailable. Please try again in a minute."
    );
  });

  it.each([400, 401, 403, 404, 409, 422, 500])("keeps the caller's wording for %i", (status) => {
    expect(apiErrorMessage(axiosFailure(status), "Failed to save")).toBe("Failed to save");
  });

  it("never echoes the response body into the page", () => {
    const hostile = { error: { message: "<img src=x onerror=alert(1)>" }, message: "<script>" };

    for (const status of [429, 503, 400]) {
      expect(apiErrorMessage(axiosFailure(status, {}, hostile), "Failed")).not.toMatch(/[<>]/);
    }
  });

  it.each([
    ["a network failure with no response", new AxiosError("Network Error", "ERR_NETWORK")],
    ["a plain Error", new Error("boom")],
    ["a thrown string", "boom"],
    ["nothing", undefined],
  ])("keeps the caller's wording for %s", (_label, error) => {
    expect(apiErrorMessage(error, "Failed")).toBe("Failed");
  });
});

describe("describeWait", () => {
  it.each([
    [1, "1 second"],
    [45, "45 seconds"],
    [59, "59 seconds"],
    [60, "1 minute"],
    [61, "2 minutes"],
    [180, "3 minutes"],
  ])("%i seconds reads as %s", (seconds, text) => {
    expect(describeWait(seconds)).toBe(text);
  });
});
