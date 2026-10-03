import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADERS } from "../../support/origin";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));

const logWarn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logError: vi.fn(), logWarn }));

const { assertTrustedActionOrigin } = await import("@/lib/http/action-origin");

describe("assertTrustedActionOrigin", () => {
  beforeEach(() => {
    requestHeaders.current = new Headers();
  });

  it("allows an action posted from the trusted origin", async () => {
    requestHeaders.current = new Headers(SAME_ORIGIN_HEADERS);

    await expect(assertTrustedActionOrigin()).resolves.toBeUndefined();
  });

  it("refuses an action posted cross-site", async () => {
    requestHeaders.current = new Headers({
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    });

    await expect(assertTrustedActionOrigin()).rejects.toMatchObject({
      code: "untrusted_origin",
    });
    expect(logWarn.mock.calls[0][1]).toMatchObject({
      method: "POST",
      path: "server-action",
    });
  });

  it("refuses an action whose forwarded host was spoofed to match", async () => {
    // Next.js's own check compares Origin with X-Forwarded-Host. This one does
    // not consult it, so a proxy forwarding a hostile host changes nothing.
    requestHeaders.current = new Headers({
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
    });

    await expect(assertTrustedActionOrigin()).rejects.toMatchObject({
      code: "untrusted_origin",
    });
  });

  it("refuses an action with no Origin", async () => {
    await expect(assertTrustedActionOrigin()).rejects.toMatchObject({
      code: "untrusted_origin",
    });
  });
});
