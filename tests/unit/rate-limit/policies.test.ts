import { describe, expect, it } from "vitest";

import {
  assertValidPolicies,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
} from "@/lib/rate-limit/policies";

const entries = Object.entries(RATE_LIMIT_POLICIES) as [string, RateLimitPolicy][];

describe("RATE_LIMIT_POLICIES", () => {
  it("is valid", () => {
    expect(() => assertValidPolicies()).not.toThrow();
  });

  it("refuses an invalid table", () => {
    expect(() =>
      assertValidPolicies({
        broken: {
          description: "x",
          ip: { burst: 0, sustained: { limit: 1, periodSeconds: 1 } },
          onStoreFailure: "allow",
        },
      })
    ).toThrow("broken.ip");
    expect(() =>
      assertValidPolicies({
        broken: {
          description: "x",
          user: { burst: 5, sustained: { limit: 1, periodSeconds: 1 } },
          ip: { burst: 1, sustained: { limit: 1, periodSeconds: 1 } },
          onStoreFailure: "allow",
        },
      })
    ).toThrow("broken.user");
  });

  it("covers every operation #46 names", () => {
    expect(Object.keys(RATE_LIMIT_POLICIES).sort()).toEqual([
      "ai.request",
      "certificate.generate",
      "checkout.create",
      "community.comment",
      "community.post",
      "community.react",
      "quiz.start",
      "quiz.submit",
      "upload.request",
      "webhook.clerk",
      "webhook.stripe",
      "write.default",
    ]);
  });

  it.each(entries)("%s never limits an address tighter than a user", (_name, policy) => {
    // Many learners share one campus address. A per-address limit below the
    // per-user one would lock a classroom out before any one learner hit theirs.
    if (!policy.user) return;
    expect(policy.ip.burst).toBeGreaterThanOrEqual(policy.user.burst);
    expect(policy.ip.sustained.limit / policy.ip.sustained.periodSeconds).toBeGreaterThanOrEqual(
      policy.user.sustained.limit / policy.user.sustained.periodSeconds
    );
  });

  it("fails closed exactly where an unbounded burst costs money or a quota", () => {
    const closed = entries
      .filter(([, policy]) => policy.onStoreFailure === "deny")
      .map(([name]) => name)
      .sort();

    expect(closed).toEqual(["ai.request", "certificate.generate", "checkout.create", "upload.request"]);
  });

  it("limits webhooks by address only", () => {
    expect("user" in RATE_LIMIT_POLICIES["webhook.stripe"]).toBe(false);
    expect("user" in RATE_LIMIT_POLICIES["webhook.clerk"]).toBe(false);
  });

  it.each(entries)("%s describes itself", (_name, policy) => {
    expect(policy.description.length).toBeGreaterThan(10);
  });
});
