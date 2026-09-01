import { describe, expect, it } from "vitest";

import { isAdminClient, isFacultyClient } from "@/lib/roles-client";

/**
 * These helpers read Clerk `publicMetadata`, which the browser can observe and
 * a determined user can attempt to influence. They exist to decide whether to
 * *render* an admin link, never to decide whether an action is allowed. The
 * tests below therefore focus on the shapes an untrusted metadata bag can take.
 */
describe("client-side role helpers", () => {
  it("recognises an exact ADMIN role", () => {
    expect(isAdminClient({ role: "ADMIN" })).toBe(true);
    expect(isFacultyClient({ role: "ADMIN" })).toBe(true);
  });

  it("treats FACULTY as faculty but not as admin", () => {
    expect(isFacultyClient({ role: "FACULTY" })).toBe(true);
    expect(isAdminClient({ role: "FACULTY" })).toBe(false);
  });

  it("grants nothing to STUDENT", () => {
    expect(isAdminClient({ role: "STUDENT" })).toBe(false);
    expect(isFacultyClient({ role: "STUDENT" })).toBe(false);
  });

  it("grants nothing when metadata is absent", () => {
    for (const empty of [undefined, null, {}]) {
      expect(isAdminClient(empty)).toBe(false);
      expect(isFacultyClient(empty)).toBe(false);
    }
  });

  it("grants nothing for values that merely resemble a role", () => {
    // Case and whitespace variants must not pass. A metadata bag is attacker-
    // adjacent data, and these helpers gate what a privileged UI reveals.
    for (const lookalike of ["admin", "Admin", " ADMIN", "ADMIN ", "ADMINISTRATOR"]) {
      expect(isAdminClient({ role: lookalike })).toBe(false);
    }
    for (const lookalike of ["faculty", "Faculty", " FACULTY"]) {
      expect(isFacultyClient({ role: lookalike })).toBe(false);
    }
  });

  it("grants nothing when role is a non-string", () => {
    for (const wrongType of [1, true, {}, [], null, ["ADMIN"]]) {
      expect(isAdminClient({ role: wrongType })).toBe(false);
      expect(isFacultyClient({ role: wrongType })).toBe(false);
    }
  });

  it("ignores unrelated metadata keys", () => {
    expect(isAdminClient({ isAdmin: true, role: "STUDENT" })).toBe(false);
    expect(isFacultyClient({ Role: "FACULTY" })).toBe(false);
  });
});
