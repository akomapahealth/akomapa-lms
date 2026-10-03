import { beforeEach, describe, expect, it, vi } from "vitest";

const logError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logError, logWarn: vi.fn(), logInfo: vi.fn() }));

const { assertCronRequest } = await import("@/lib/http/cron");

const SECRET = "cron-placeholder-secret-0123456789";
const ENV = { CRON_SECRET: SECRET };

function request(authorization?: string) {
  return new Request("https://academy.example/api/cron/outbox", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

beforeEach(() => logError.mockClear());

describe("assertCronRequest (#69)", () => {
  it("accepts Vercel Cron's bearer secret", () => {
    expect(() => assertCronRequest(request(`Bearer ${SECRET}`), ENV)).not.toThrow();
  });

  it.each([
    ["no header", undefined],
    ["the wrong secret", "Bearer not-the-secret-at-all-000000"],
    ["a prefix of the secret", `Bearer ${SECRET.slice(0, -1)}`],
    ["the secret without the scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["an empty bearer", "Bearer "],
  ])("refuses %s as unauthenticated", (_label, header) => {
    expect(() => assertCronRequest(request(header), ENV)).toThrow(
      expect.objectContaining({ code: "unauthenticated" })
    );
  });

  it.each([
    ["missing", {}],
    ["too short to be a secret", { CRON_SECRET: "short" }],
  ])("fails closed, as a logged fault, when the secret is %s", (_label, env) => {
    expect(() => assertCronRequest(request(`Bearer ${SECRET}`), env)).toThrow(
      expect.objectContaining({ code: "internal" })
    );
    expect(logError).toHaveBeenCalledWith("CRON_CONFIG", expect.any(Error), expect.any(Object));
    // The secret must never reach a log line.
    expect(JSON.stringify(logError.mock.calls)).not.toContain(SECRET);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect(() => assertCronRequest(request(`Bearer ${SECRET}`))).not.toThrow();
  });
});
