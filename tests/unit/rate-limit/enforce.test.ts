import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/http/problem";
import {
  enforceRateLimit,
  RATE_LIMIT_POLICIES,
  STORE_FAILURE_RETRY_SECONDS,
  STORE_TIMEOUT_MS,
} from "@/lib/rate-limit";
import { VERIFIED_IP_HEADER } from "@/lib/rate-limit/client-ip";
import { bucketKey } from "@/lib/rate-limit/key";

import { failingStore, hangingStore, memoryStore } from "../support/rate-limit-store";

const logError = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logError, logWarn }));

const T0 = 1_700_000_000_000;
const ENV = { CLERK_SECRET_KEY: "unit-placeholder-secret", VERCEL: "1" };
const OFF_VERCEL = { CLERK_SECRET_KEY: "unit-placeholder-secret" };

function request(ip?: string): Request {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: ip === undefined ? {} : { [VERIFIED_IP_HEADER]: ip },
  });
}

/** Calls the limiter and returns the thrown ApiError, or null if it allowed. */
async function attempt(
  options: Parameters<typeof enforceRateLimit>[3] & { ip?: string; userId?: string | null },
  policy: Parameters<typeof enforceRateLimit>[1] = "quiz.start"
): Promise<ApiError | null> {
  const { ip, userId, ...rest } = options;
  try {
    await enforceRateLimit(request(ip), policy, { userId }, { env: ENV, now: () => T0, ...rest });
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}

beforeEach(() => {
  logError.mockClear();
  logWarn.mockClear();
});

describe("enforceRateLimit", () => {
  it("allows up to the user burst and refuses the next, with a retry delay", async () => {
    const store = memoryStore();
    const burst = RATE_LIMIT_POLICIES["quiz.start"].user.burst;

    for (let i = 0; i < burst; i += 1) {
      expect(await attempt({ store, userId: "user_1", ip: "203.0.113.7" })).toBeNull();
    }
    const refused = await attempt({ store, userId: "user_1", ip: "203.0.113.7" });

    expect(refused?.code).toBe("rate_limited");
    // quiz.start sustains 30/hour: one every 120s.
    expect(refused?.retryAfterSeconds).toBe(120);
  });

  it("recovers at the sustained rate", async () => {
    const store = memoryStore();
    for (let i = 0; i < 5; i += 1) await attempt({ store, userId: "user_1" });

    expect(await attempt({ store, userId: "user_1", now: () => T0 + 119_999 })).not.toBeNull();
    expect(await attempt({ store, userId: "user_1", now: () => T0 + 120_000 })).toBeNull();
  });

  it("keeps users apart", async () => {
    const store = memoryStore();
    for (let i = 0; i < 5; i += 1) await attempt({ store, userId: "user_1", ip: "203.0.113.7" });

    expect(await attempt({ store, userId: "user_1", ip: "203.0.113.7" })).not.toBeNull();
    // Same network, different learner: the per-address limit is loose enough
    // for a shared campus address.
    expect(await attempt({ store, userId: "user_2", ip: "203.0.113.7" })).toBeNull();
  });

  it("limits by address across accounts, so new accounts do not buy a new budget", async () => {
    const store = memoryStore();
    const ipBurst = RATE_LIMIT_POLICIES["quiz.start"].ip.burst;

    for (let i = 0; i < ipBurst; i += 1) {
      expect(await attempt({ store, userId: `user_${i}`, ip: "203.0.113.7" })).toBeNull();
    }
    const refused = await attempt({ store, userId: "user_new", ip: "203.0.113.7" });

    expect(refused?.code).toBe("rate_limited");
    expect(logWarn).toHaveBeenLastCalledWith("RATE_LIMITED", expect.objectContaining({ dimension: "ip" }));
  });

  it("treats every address in an IPv6 /64 as one client", async () => {
    const store = memoryStore();
    const ipBurst = RATE_LIMIT_POLICIES["webhook.stripe"].ip.burst;

    for (let i = 0; i < ipBurst; i += 1) {
      await attempt({ store, ip: `2001:db8:1:2::${i.toString(16)}` }, "webhook.stripe");
    }

    expect(await attempt({ store, ip: "2001:db8:1:2:ffff::1" }, "webhook.stripe")).not.toBeNull();
    expect(await attempt({ store, ip: "2001:db8:1:3::1" }, "webhook.stripe")).toBeNull();
  });

  it("keeps an IPv4 client and its IPv4-mapped form in one bucket", async () => {
    const store = memoryStore();
    await attempt({ store, ip: "203.0.113.7" }, "webhook.stripe");
    await attempt({ store, ip: "::ffff:203.0.113.7" }, "webhook.stripe");

    expect(new Set(store.calls).size).toBe(1);
  });

  it("limits an authenticated caller by user alone when the address is unknown", async () => {
    // Off Vercel there is no verified address. A shared "unknown" bucket would
    // let one person exhaust it for everybody, so it is not used here.
    const store = memoryStore();

    await attempt({ store, userId: "user_1", env: OFF_VERCEL });

    expect(store.calls).toEqual([bucketKey("quiz.start", "user", "user_1", OFF_VERCEL)]);
  });

  it("puts anonymous callers with no verified address in one shared bucket", async () => {
    const store = memoryStore();

    await attempt({ store, env: OFF_VERCEL }, "webhook.clerk");

    expect(store.calls).toEqual([bucketKey("webhook.clerk", "ip", "unknown", OFF_VERCEL)]);
  });

  it("limits anonymous callers by address", async () => {
    const store = memoryStore();

    await attempt({ store, userId: null, ip: "203.0.113.7" });

    expect(store.calls).toEqual([bucketKey("quiz.start", "ip", "203.0.113.7", ENV)]);
  });

  it("ignores the user dimension for an address-only policy", async () => {
    const store = memoryStore();

    await attempt({ store, userId: "user_1", ip: "203.0.113.7" }, "webhook.stripe");

    expect(store.calls).toEqual([bucketKey("webhook.stripe", "ip", "203.0.113.7", ENV)]);
  });

  it("keeps policies apart", async () => {
    const store = memoryStore();
    for (let i = 0; i < 5; i += 1) await attempt({ store, userId: "user_1" });

    expect(await attempt({ store, userId: "user_1" }, "quiz.start")).not.toBeNull();
    expect(await attempt({ store, userId: "user_1" }, "quiz.submit")).toBeNull();
  });

  it.each([
    // [user delay, ip delay] -> the longer wins, in either order.
    [90_000, 30_000, 90, "user"],
    [30_000, 90_000, 90, "ip"],
  ])(
    "reports the longer delay when both dimensions refuse (user %ims, ip %ims)",
    async (userDelay, ipDelay, seconds, dimension) => {
      // Buckets are consumed user first, then address.
      const delays = [userDelay, ipDelay];
      const store = {
        consume: async () => ({ allowed: false, tat: T0, retryAfterMs: delays.shift()!, remaining: 0 }),
      };

      const refused = await attempt({ store, userId: "u", ip: "203.0.113.9" });

      expect(refused?.retryAfterSeconds).toBe(seconds);
      expect(logWarn).toHaveBeenLastCalledWith(
        "RATE_LIMITED",
        expect.objectContaining({ dimension })
      );
    }
  );

  it("charges a cost", async () => {
    const store = memoryStore();

    expect(await attempt({ store, userId: "user_1", cost: 5 })).toBeNull();
    expect(await attempt({ store, userId: "user_1" })).not.toBeNull();
  });

  it.each([0, 1.5, 6])("rejects a cost of %s as a programming error", async (cost) => {
    await expect(
      enforceRateLimit(request(), "quiz.start", { userId: "u" }, { store: memoryStore(), env: ENV, cost })
    ).rejects.toThrow("does not fit burst");
  });

  it("logs a refusal by policy and dimension only", async () => {
    const store = memoryStore();
    for (let i = 0; i < 6; i += 1) {
      await attempt({ store, userId: "user_secret_id", ip: "203.0.113.7" });
    }

    const [, context] = logWarn.mock.calls.at(-1)!;
    expect(context).toEqual({
      correlationId: expect.any(String),
      policy: "quiz.start",
      dimension: "user",
      retryAfterSeconds: 120,
    });
    const logged = JSON.stringify(logWarn.mock.calls);
    expect(logged).not.toContain("user_secret_id");
    expect(logged).not.toContain("203.0.113.7");
    expect(logged).not.toContain("rl1:");
  });

  it("answers identically whatever resource the request named", async () => {
    // The key has no resource in it, so a 429 says nothing about whether the
    // Course, post, or attempt in the URL exists.
    const store = memoryStore();
    const call = (path: string) =>
      enforceRateLimit(
        new Request(`http://localhost:3000${path}`, { method: "POST" }),
        "quiz.start",
        { userId: "user_1" },
        { store, env: OFF_VERCEL, now: () => T0 }
      ).catch((error: ApiError) => [error.code, error.retryAfterSeconds]);

    for (let i = 0; i < 5; i += 1) await call(`/api/courses/real-${i}/quizzes/q/start`);

    expect(await call("/api/courses/does-not-exist/quizzes/q/start")).toEqual(
      await call("/api/courses/real-0/quizzes/q/start")
    );
  });

  describe("when the store fails", () => {
    it("allows, and logs, for a policy that fails open", async () => {
      expect(await attempt({ store: failingStore(), userId: "u" }, "quiz.submit")).toBeNull();
      expect(logError).toHaveBeenCalledWith(
        "RATE_LIMIT_STORE_FAILURE",
        expect.any(Error),
        expect.objectContaining({ policy: "quiz.submit", onStoreFailure: "allow" })
      );
    });

    it("answers 503 with Retry-After for a policy that fails closed", async () => {
      const refused = await attempt({ store: failingStore(), userId: "u" }, "checkout.create");

      expect(refused?.code).toBe("temporarily_unavailable");
      expect(refused?.retryAfterSeconds).toBe(STORE_FAILURE_RETRY_SECONDS);
      expect(logError).toHaveBeenCalledWith(
        "RATE_LIMIT_STORE_FAILURE",
        expect.any(Error),
        expect.objectContaining({ correlationId: refused?.correlationId })
      );
    });

    it("treats a hung store as failed rather than hanging the request", async () => {
      vi.useFakeTimers();
      const pending = attempt({ store: hangingStore(), userId: "u" }, "certificate.generate");
      await vi.advanceTimersByTimeAsync(STORE_TIMEOUT_MS);

      expect((await pending)?.code).toBe("temporarily_unavailable");
    });

    it("treats a missing key-derivation secret as a store failure", async () => {
      const refused = await attempt({ store: memoryStore(), userId: "u", env: { VERCEL: "1" } }, "upload.request");

      expect(refused?.code).toBe("temporarily_unavailable");
    });

    it("lets a fail-open policy through without a secret, too", async () => {
      expect(await attempt({ store: memoryStore(), userId: "u", env: {} }, "write.default")).toBeNull();
    });
  });

  it("uses the PostgreSQL store and the real clock by default", async () => {
    // The unit suite's database double answers raw queries with no rows, which
    // the store cannot interpret: proof the default store was the one called.
    vi.stubEnv("CLERK_SECRET_KEY", "unit-placeholder-secret");
    await expect(
      enforceRateLimit(request(), "checkout.create", { userId: "u" })
    ).rejects.toMatchObject({ code: "temporarily_unavailable" });
  });
});
