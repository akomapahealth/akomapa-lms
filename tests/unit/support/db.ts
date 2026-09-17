import { vi } from "vitest";

/**
 * A Prisma test double.
 *
 * Domain logic under test must never reach a real database, so `@/lib/db` is
 * replaced by this object. Delegates are created lazily by a Proxy, which means
 * a test never has to enumerate the models a service happens to touch, and
 * adding a model to a service does not require editing this file.
 *
 * Defaults are deliberately the *empty, deny-leaning* answers a fresh database
 * would give: `null`, `[]`, `0`. A service that forgets to check its inputs
 * therefore fails closed in tests rather than silently reading `undefined`.
 * Writes have no default at all — a test that expects a write must say so.
 */
type Delegate = Record<string, ReturnType<typeof vi.fn>>;

const READ_DEFAULTS: Record<string, unknown> = {
  findUnique: null,
  findFirst: null,
  findMany: [],
  count: 0,
  aggregate: null,
  groupBy: [],
};

const WRITE_METHODS = [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
] as const;

function createDelegate(model: string): Delegate {
  const delegate: Delegate = {};

  for (const [method, value] of Object.entries(READ_DEFAULTS)) {
    delegate[method] = vi.fn().mockResolvedValue(value);
  }

  for (const method of WRITE_METHODS) {
    delegate[method] = vi.fn().mockRejectedValue(
      new Error(
        `db.${model}.${method}() was called but no result was configured. ` +
          `Configure it explicitly in the test, e.g. ` +
          `dbMock.${model}.${method}.mockResolvedValue(...).`
      )
    );
  }

  return delegate;
}

function createDbMock() {
  const models = new Map<string, Delegate>();
  const clientMethods = new Map<string, ReturnType<typeof vi.fn>>();

  return new Proxy({} as Record<string, Delegate>, {
    get(_target, prop: string) {
      // Client-level methods are functions, not model delegates. Without this
      // they would be handed back as an object named `$queryRaw`, and a test
      // configuring one would fail on a missing `mockResolvedValue`.
      if (prop === "$queryRaw" || prop === "$queryRawUnsafe" ||
          prop === "$executeRaw" || prop === "$executeRawUnsafe") {
        if (!clientMethods.has(prop)) {
          clientMethods.set(prop, vi.fn().mockResolvedValue([]));
        }
        return clientMethods.get(prop)!;
      }
      if (prop === "$transaction") {
        // Callback form runs inline against the same mock; array form resolves
        // each promise. Real transactional guarantees are #107's job.
        return vi.fn(async (arg: unknown) =>
          typeof arg === "function"
            ? await (arg as (tx: unknown) => unknown)(proxy)
            : await Promise.all(arg as Promise<unknown>[])
        );
      }
      if (!models.has(prop)) {
        models.set(prop, createDelegate(prop));
      }
      return models.get(prop)!;
    },
  });
}

let proxy = createDbMock();

/**
 * The shared double. Test files wire it in with:
 *
 *   vi.mock("@/lib/db", async () => ({
 *     db: (await import("./support/db")).dbMock,
 *   }));
 */
export const dbMock = new Proxy({} as Record<string, Delegate>, {
  get: (_t, prop: string) => proxy[prop],
});

/** Re-arms every delegate with its default. Called globally before each test. */
export function resetDbMock(): void {
  proxy = createDbMock();
}
