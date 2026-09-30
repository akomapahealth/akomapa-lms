import { describe, expect, it } from "vitest";

import {
  ENROLLMENT_STATUSES,
  LOCKED_STATE_MESSAGE,
  normalizeEnrollmentStatus,
} from "@/lib/entitlement/types";

describe("ENROLLMENT_STATUSES", () => {
  it("is exactly what the schema comment documents", () => {
    // `Enrollment.status` is a free-form String until #50 turns it into an enum.
    // Until then this array is the only place the allowed values are written down.
    expect([...ENROLLMENT_STATUSES]).toEqual(["ACTIVE", "COMPLETED", "SUSPENDED"]);
  });
});

describe("normalizeEnrollmentStatus", () => {
  it.each([...ENROLLMENT_STATUSES])("accepts %s", (status) => {
    expect(normalizeEnrollmentStatus(status)).toBe(status);
  });

  it.each([
    ["lowercase", "active"],
    ["padded", " ACTIVE "],
    ["a future status", "PAUSED"],
    ["empty", ""],
    ["a number", 1],
    ["null", null],
    ["undefined", undefined],
    ["an object", { status: "ACTIVE" }],
    ["a boolean", true],
  ])("refuses %s", (_label, value) => {
    // A row written by hand, by a half-finished migration, or by a future status
    // this code does not know must never read as access. `null` is "not a status
    // this system recognises", and every caller treats that as no entitlement.
    expect(normalizeEnrollmentStatus(value)).toBeNull();
  });
});

describe("LOCKED_STATE_MESSAGE", () => {
  it("has copy for every reason that denies or limits access", () => {
    for (const reason of ["not_enrolled", "suspended", "course_unpublished", "course_not_found"] as const) {
      expect(LOCKED_STATE_MESSAGE[reason].length).toBeGreaterThan(0);
    }
  });

  it("is empty for the reasons that grant access", () => {
    // There is no locked state to describe when access was granted.
    for (const reason of ["active_enrollment", "completed_enrollment", "staff_access"] as const) {
      expect(LOCKED_STATE_MESSAGE[reason]).toBe("");
    }
  });

  it("never names another learner, the owner, or the rules", () => {
    // It is rendered to the learner whose access is limited.
    for (const message of Object.values(LOCKED_STATE_MESSAGE)) {
      expect(message.toLowerCase()).not.toContain("purchase");
      expect(message.toLowerCase()).not.toContain("admin");
      expect(message.toLowerCase()).not.toContain("faculty");
    }
  });
});
