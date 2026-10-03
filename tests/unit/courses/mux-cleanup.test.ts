import { beforeEach, describe, expect, it, vi } from "vitest";

const assetDelete = vi.hoisted(() => vi.fn());
vi.mock("@mux/mux-node", () => {
  class Mux {
    video = { assets: { delete: assetDelete } };
  }
  return { default: Mux, Mux };
});

const logError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logError, logWarn: vi.fn() }));

const { deleteMuxAssets } = await import("@/lib/courses/mux-cleanup");

describe("deleteMuxAssets", () => {
  beforeEach(() => {
    assetDelete.mockReset();
    logError.mockClear();
  });

  it("deletes every asset", async () => {
    assetDelete.mockResolvedValue(undefined);

    await deleteMuxAssets(["a1", "a2"], "TAG");

    expect(assetDelete.mock.calls).toEqual([["a1"], ["a2"]]);
  });

  it("does nothing for no assets", async () => {
    await deleteMuxAssets([], "TAG");

    expect(assetDelete).not.toHaveBeenCalled();
  });

  it("logs a failure by asset id and carries on with the rest", async () => {
    // The database delete already happened; a failed cleanup is an orphaned
    // asset to report, not a request to fail.
    assetDelete.mockRejectedValueOnce(new Error("mux down")).mockResolvedValueOnce(undefined);

    await expect(deleteMuxAssets(["a1", "a2"], "TAG")).resolves.toBeUndefined();

    expect(assetDelete).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith("TAG_MUX_CLEANUP", expect.any(Error), { assetId: "a1" });
  });
});
