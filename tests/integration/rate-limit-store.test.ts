import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { testConnectionString, testDb } from "./support/db";

vi.mock("@/lib/db", async () => {
  const { testDb: get } = await import("./support/db");
  return {
    get db() {
      return get();
    },
  };
});

const { decide, rateOf } = await import("@/lib/rate-limit/gcra");
const { postgresStore, sweepExpired } = await import("@/lib/rate-limit/store");
const { enforceRateLimit } = await import("@/lib/rate-limit");

/**
 * The rate-limit store against real PostgreSQL (#46).
 *
 * A double can model the arithmetic but not the property that matters: that
 * concurrent requests from different serverless instances, each with its own
 * connection pool, are serialised by the database and admit exactly the burst.
 * Everything here runs the production SQL.
 */
const T0 = 1_700_000_000_000;
// 5 at once, then 60 an hour.
const RATE = rateOf({ burst: 5, sustained: { limit: 60, periodSeconds: 3600 } });

const never = () => 1; // the sweep never runs unless a test asks for it

/** A second client with its own pool: a second serverless instance. */
let otherInstance: PrismaClient;
let otherPool: Pool;

beforeAll(async () => {
  otherPool = new Pool({ connectionString: testConnectionString(), max: 10 });
  otherInstance = new PrismaClient({ adapter: new PrismaPg(otherPool) });
});

afterAll(async () => {
  await otherInstance.$disconnect();
  await otherPool.end();
});

async function row(key: string) {
  const rows = await testDb().$queryRaw<{ tat: bigint; allowed: boolean; expiresAt: Date }[]>`
    SELECT "tat", "allowed", "expiresAt" FROM "RateLimitBucket" WHERE "key" = ${key}
  `;
  return rows[0];
}

describe("postgresStore", () => {
  const store = postgresStore({ random: never });

  it("admits exactly the burst at one instant, then refuses with the GCRA delay", async () => {
    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await store.consume("k", T0, RATE, 1));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0, 0]);
    expect(results[5].retryAfterMs).toBe(60_000);
  });

  it("agrees with the pure decision function at every step", async () => {
    let tat: number | null = null;
    const instants = [0, 0, 0, 10_000, 59_999, 60_000, 60_000, 300_000, 300_001, 400_000];

    for (const offset of instants) {
      const expected = decide(tat, T0 + offset, RATE);
      const actual = await store.consume("agree", T0 + offset, RATE, 1);
      expect(actual).toEqual(expected);
      if (expected.allowed) tat = expected.tat;
    }
  });

  it("does not consume on a refusal", async () => {
    for (let i = 0; i < 5; i += 1) await store.consume("r", T0, RATE, 1);
    const before = await row("r");

    await store.consume("r", T0, RATE, 1);

    const after = await row("r");
    expect(after.tat).toBe(before.tat);
    expect(after.expiresAt).toEqual(before.expiresAt);
    expect(after.allowed).toBe(false);
  });

  it("stores expiresAt as the moment the bucket is full again", async () => {
    await store.consume("e", T0, RATE, 2);

    const stored = await row("e");
    expect(Number(stored.tat)).toBe(T0 + 120_000);
    expect(stored.expiresAt.getTime()).toBe(T0 + 120_000);
  });

  it("charges a cost in one statement", async () => {
    expect((await store.consume("c", T0, RATE, 5)).allowed).toBe(true);
    expect((await store.consume("c", T0, RATE, 1)).allowed).toBe(false);
  });

  it("keeps keys independent", async () => {
    for (let i = 0; i < 5; i += 1) await store.consume("a", T0, RATE, 1);

    expect((await store.consume("a", T0, RATE, 1)).allowed).toBe(false);
    expect((await store.consume("b", T0, RATE, 1)).allowed).toBe(true);
  });

  it("admits exactly the burst under concurrency from two instances", async () => {
    // 40 simultaneous requests for one key, split across two independent
    // connection pools. Without the row lock, several would read the same TAT
    // and all be admitted.
    const instanceA = postgresStore({ random: never });
    const instanceB = postgresStore({ client: otherInstance, random: never });

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        (i % 2 === 0 ? instanceA : instanceB).consume("contended", T0, RATE, 1)
      )
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(Number((await row("contended")).tat)).toBe(T0 + 5 * 60_000);
  });

  it("admits exactly the burst when the first requests race to create the row", async () => {
    // The insert path: no row exists, and every request tries to create it.
    const instanceB = postgresStore({ client: otherInstance, random: never });
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 === 0 ? store : instanceB).consume("fresh", T0, RATE, 1)
      )
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("sweeps only expired buckets", async () => {
    await store.consume("old", T0 - 3_600_000, RATE, 1);
    await store.consume("live", T0, RATE, 1);

    await sweepExpired(T0);

    expect(await row("old")).toBeUndefined();
    expect(await row("live")).toBeDefined();
  });

  it("sweeps when the dice say so, without affecting the decision", async () => {
    await store.consume("stale", T0 - 3_600_000, RATE, 1);
    const sweeping = postgresStore({ random: () => 0 });

    const decision = await sweeping.consume("now", T0, RATE, 1);

    expect(decision.allowed).toBe(true);
    expect(await row("stale")).toBeUndefined();
  });

  it("logs and swallows a failed sweep", async () => {
    const failing = { $executeRaw: () => Promise.reject(new Error("lock timeout")) };

    await expect(sweepExpired(T0, failing as never)).resolves.toBeUndefined();
  });

  it("rejects when the database is unreachable, for enforceRateLimit to handle", async () => {
    const deadPool = new Pool({
      connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none",
      connectionTimeoutMillis: 500,
    });
    const dead = new PrismaClient({ adapter: new PrismaPg(deadPool) });
    const unreachable = postgresStore({ client: dead, random: never });

    await expect(unreachable.consume("x", T0, RATE, 1)).rejects.toBeDefined();

    // And the policy decides what that means.
    const env = { CLERK_SECRET_KEY: "integration-placeholder-secret" };
    const req = () => new Request("http://localhost:3000/api/x", { method: "POST" });
    await expect(
      enforceRateLimit(req(), "quiz.submit", { userId: "u" }, { store: unreachable, env })
    ).resolves.toBeUndefined();
    await expect(
      enforceRateLimit(req(), "checkout.create", { userId: "u" }, { store: unreachable, env })
    ).rejects.toMatchObject({ code: "temporarily_unavailable", retryAfterSeconds: 30 });

    await dead.$disconnect();
    await deadPool.end();
  });
});

describe("enforceRateLimit with the default store", () => {
  const env = { CLERK_SECRET_KEY: "integration-placeholder-secret", VERCEL: "1" };
  const req = () =>
    new Request("http://localhost:3000/api/x", {
      method: "POST",
      headers: { "x-vercel-forwarded-for": "203.0.113.7" },
    });

  it("persists hashed keys only: no user id or address in the table", async () => {
    await enforceRateLimit(req(), "quiz.start", { userId: "user_identifiable" }, { env });

    const keys = await testDb().$queryRaw<{ key: string }[]>`SELECT "key" FROM "RateLimitBucket"`;
    expect(keys).toHaveLength(2);
    for (const { key } of keys) {
      expect(key).toMatch(/^rl1:/);
      expect(key).not.toContain("user_identifiable");
      expect(key).not.toContain("203.0.113.7");
    }
  });

  it("limits across calls through the real store", async () => {
    for (let i = 0; i < 5; i += 1) {
      await enforceRateLimit(req(), "quiz.start", { userId: "u1" }, { env, now: () => T0 });
    }

    await expect(
      enforceRateLimit(req(), "quiz.start", { userId: "u1" }, { env, now: () => T0 })
    ).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 120 });
  });
});
