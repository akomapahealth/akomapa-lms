import { describe, expect, it, vi } from "vitest";

import {
  applyPlacements,
  isUniqueViolation,
  POSITION_ATTEMPTS,
  TEMPORARY_POSITION_BASE,
  withPositionRetry,
} from "@/lib/courses/ordering";
import { NUMBER } from "@/lib/http/limits";

function uniqueViolation() {
  const error = new Error("Unique constraint failed");
  error.name = "PrismaClientKnownRequestError";
  Object.assign(error, { code: "P2002" });
  return error;
}

describe("applyPlacements", () => {
  it("parks every row at a distinct temporary position before any final write", async () => {
    const writes: [string, number][] = [];

    await applyPlacements(
      [
        { id: "a", position: 2 },
        { id: "b", position: 1 },
      ],
      async (id, position) => {
        writes.push([id, position]);
      }
    );

    expect(writes).toEqual([
      ["a", TEMPORARY_POSITION_BASE],
      ["b", TEMPORARY_POSITION_BASE + 1],
      ["a", 2],
      ["b", 1],
    ]);
  });

  it("parks rows above any position a request may ask for", () => {
    expect(TEMPORARY_POSITION_BASE).toBeGreaterThan(NUMBER.maxPosition);
  });
});

describe("isUniqueViolation", () => {
  it("recognises P2002 only", () => {
    expect(isUniqueViolation(uniqueViolation())).toBe(true);

    const other = uniqueViolation();
    Object.assign(other, { code: "P2003" });
    expect(isUniqueViolation(other)).toBe(false);
    expect(isUniqueViolation(new Error("P2002"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});

describe("withPositionRetry", () => {
  it("returns the first success", async () => {
    const create = vi.fn().mockResolvedValue("row");

    await expect(withPositionRetry(create)).resolves.toBe("row");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reads again after losing a race for the position", async () => {
    const create = vi.fn().mockRejectedValueOnce(uniqueViolation()).mockResolvedValue("row");

    await expect(withPositionRetry(create)).resolves.toBe("row");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt and lets the conflict surface", async () => {
    const create = vi.fn().mockRejectedValue(uniqueViolation());

    await expect(withPositionRetry(create)).rejects.toMatchObject({ code: "P2002" });
    expect(create).toHaveBeenCalledTimes(POSITION_ATTEMPTS);
  });

  it("never retries any other failure", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection lost"));

    await expect(withPositionRetry(create)).rejects.toThrow("connection lost");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
