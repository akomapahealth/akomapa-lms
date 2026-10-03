import { describe, expect, it } from "vitest";

import { assertValidLimit, decide, rateOf, type Limit } from "@/lib/rate-limit/gcra";

// 3 at once, then 60 an hour: one every 60 seconds.
const LIMIT: Limit = { burst: 3, sustained: { limit: 60, periodSeconds: 3600 } };
const RATE = rateOf(LIMIT);
const T0 = 1_700_000_000_000;

/** Runs `count` requests at one instant, threading the TAT like a store would. */
function burstAt(now: number, count: number, start: number | null = null) {
  let tat = start;
  const decisions = [];
  for (let i = 0; i < count; i += 1) {
    const decision = decide(tat, now, RATE);
    if (decision.allowed) tat = decision.tat;
    decisions.push(decision);
  }
  return { decisions, tat };
}

describe("rateOf", () => {
  it("derives the emission interval and capacity", () => {
    expect(RATE).toEqual({ emissionMs: 60_000, capacityMs: 180_000 });
  });

  it("rounds the interval up so integer milliseconds never exceed the rate", () => {
    // 3600s / 7 = 514285.71...ms
    expect(rateOf({ burst: 1, sustained: { limit: 7, periodSeconds: 3600 } }).emissionMs).toBe(
      514_286
    );
  });
});

describe("decide", () => {
  it("allows exactly the burst at once, then refuses", () => {
    const { decisions } = burstAt(T0, 4);

    expect(decisions.map((d) => d.allowed)).toEqual([true, true, true, false]);
    expect(decisions.map((d) => d.remaining)).toEqual([2, 1, 0, 0]);
  });

  it("tells a refused request exactly when it would succeed", () => {
    const { decisions, tat } = burstAt(T0, 4);

    expect(decisions[3].retryAfterMs).toBe(60_000);
    // One millisecond early is still refused; on time is allowed.
    expect(decide(tat, T0 + 59_999, RATE).allowed).toBe(false);
    expect(decide(tat, T0 + 60_000, RATE).allowed).toBe(true);
  });

  it("does not consume on a refusal", () => {
    const { tat } = burstAt(T0, 3);
    const refused = decide(tat, T0, RATE);

    expect(refused.allowed).toBe(false);
    expect(refused.tat).toBe(tat);
  });

  it("holds the sustained rate after the burst", () => {
    // Drain the burst, then one request per emission interval for an hour.
    let { tat } = burstAt(T0, 3);
    let allowed = 0;
    for (let t = T0 + 60_000; t <= T0 + 3_600_000; t += 60_000) {
      const decision = decide(tat, t, RATE);
      if (decision.allowed) {
        tat = decision.tat;
        allowed += 1;
      }
      // A second request in the same instant is always refused.
      expect(decide(tat, t, RATE).allowed).toBe(false);
    }
    expect(allowed).toBe(60);
  });

  it("refills completely after idling, and no further", () => {
    const { tat } = burstAt(T0, 3);
    // Long after the TAT, the bucket is full again -- but not fuller.
    const later = burstAt(T0 + 86_400_000, 4, tat);

    expect(later.decisions.map((d) => d.allowed)).toEqual([true, true, true, false]);
  });

  it("charges a cost in units", () => {
    expect(decide(null, T0, RATE, 3)).toMatchObject({ allowed: true, remaining: 0 });
    expect(decide(null, T0, RATE, 2)).toMatchObject({ allowed: true, remaining: 0 });
    expect(decide(null, T0, RATE, 1)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("refuses a cost larger than the burst, even on a fresh bucket", () => {
    expect(decide(null, T0, RATE, 4)).toEqual({
      allowed: false,
      tat: T0,
      retryAfterMs: 60_000,
      remaining: 0,
    });
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects a cost of %s", (cost) => {
    expect(() => decide(null, T0, RATE, cost)).toThrow("positive integer");
  });

  it("treats a TAT in the past as a full bucket", () => {
    expect(decide(T0 - 1_000_000, T0, RATE)).toMatchObject({ allowed: true, tat: T0 + 60_000 });
  });
});

describe("assertValidLimit", () => {
  it("accepts a sensible limit", () => {
    expect(() => assertValidLimit(LIMIT, "x")).not.toThrow();
  });

  it.each([
    ["a zero burst", { burst: 0, sustained: { limit: 10, periodSeconds: 60 } }],
    ["a zero limit", { burst: 1, sustained: { limit: 0, periodSeconds: 60 } }],
    ["a zero period", { burst: 1, sustained: { limit: 10, periodSeconds: 0 } }],
    ["a fractional burst", { burst: 1.5, sustained: { limit: 10, periodSeconds: 60 } }],
    ["a negative limit", { burst: 1, sustained: { limit: -10, periodSeconds: 60 } }],
  ])("rejects %s", (_label, limit) => {
    expect(() => assertValidLimit(limit, "x")).toThrow("positive integers");
  });

  it("rejects a burst larger than the sustained limit", () => {
    expect(() =>
      assertValidLimit({ burst: 11, sustained: { limit: 10, periodSeconds: 60 } }, "x")
    ).toThrow("cannot exceed");
  });
});
