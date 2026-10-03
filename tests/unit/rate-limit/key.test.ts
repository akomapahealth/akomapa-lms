import { describe, expect, it, vi } from "vitest";

import { bucketKey, RateLimitConfigError } from "@/lib/rate-limit/key";

const ENV = { CLERK_SECRET_KEY: "sk_test_unit" };

describe("bucketKey", () => {
  it("is stable for the same inputs", () => {
    expect(bucketKey("quiz.start", "user", "user_1", ENV)).toBe(
      bucketKey("quiz.start", "user", "user_1", ENV)
    );
  });

  it("identifies nobody: neither the subject nor the policy appears in it", () => {
    const key = bucketKey("quiz.start", "ip", "203.0.113.7", ENV);

    expect(key).toMatch(/^rl1:[A-Za-z0-9_-]{43}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(key).not.toContain("quiz");
  });

  it.each([
    ["policy", ["quiz.submit", "user", "user_1"]],
    ["dimension", ["quiz.start", "ip", "user_1"]],
    ["subject", ["quiz.start", "user", "user_2"]],
  ] as const)("changes with the %s", (_label, [policy, dimension, subject]) => {
    expect(bucketKey(policy, dimension, subject, ENV)).not.toBe(
      bucketKey("quiz.start", "user", "user_1", ENV)
    );
  });

  it("cannot be forged by moving a separator between parts", () => {
    expect(bucketKey("a", "user", "b", ENV)).not.toBe(bucketKey("a\u0000user", "user", "b", ENV));
  });

  it("depends on the secret, so keys cannot be computed without it", () => {
    expect(bucketKey("p", "user", "u", ENV)).not.toBe(
      bucketKey("p", "user", "u", { CLERK_SECRET_KEY: "sk_test_other" })
    );
  });

  it("re-derives when the secret rotates", () => {
    const before = bucketKey("p", "user", "u", ENV);
    bucketKey("p", "user", "u", { CLERK_SECRET_KEY: "sk_test_rotated" });

    expect(bucketKey("p", "user", "u", ENV)).toBe(before);
  });

  it.each([{}, { CLERK_SECRET_KEY: "" }])("refuses to derive without a secret", (env) => {
    expect(() => bucketKey("p", "user", "u", env)).toThrow(RateLimitConfigError);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_from_process");

    expect(bucketKey("p", "user", "u")).toBe(
      bucketKey("p", "user", "u", { CLERK_SECRET_KEY: "sk_test_from_process" })
    );
  });
});
