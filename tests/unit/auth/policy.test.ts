import { describe, expect, it } from "vitest";

import { ACTIONS, isAction, type Action } from "@/lib/auth/actions";
import {
  can,
  normalizeRole,
  type Principal,
  type Resource,
  type Role,
} from "@/lib/auth/policy";

/**
 * The permission matrix.
 *
 * `can` is pure, so every combination is cheap and the matrix is covered
 * exhaustively rather than sampled. The suite is written deny-first: for each
 * action it names the one principal that should be allowed and then asserts
 * that every other principal is refused, because the failure that matters is a
 * guard that does not hold, not a feature that does not work.
 *
 * Implements ADR 0001. Documented in docs/permission-matrix.md.
 */

const OWNER = "user_owner";
const OTHER = "user_other";
const ASSIGNED = "user_assigned";

const asRole = (role: Role, userId = OWNER): Principal => ({ userId, role });

const student = asRole("STUDENT");
const faculty = asRole("FACULTY");
const admin = asRole("ADMIN");
const otherFaculty = asRole("FACULTY", OTHER);
const otherAdmin = asRole("ADMIN", OTHER);
// A moderator who is NOT the author. `otherAdmin` shares OTHER's id, so using it
// against OTHER's content tests the author path, not the moderator path.
const moderator = asRole("ADMIN", "user_moderator");

const ownedCourse: Resource = { kind: "course", ownerId: OWNER };
const otherCourse: Resource = { kind: "course", ownerId: OTHER };

/** Classification of every action, so the tests below can be exhaustive. */
const ADMIN_ONLY: Action[] = [
  "community:moderate",
  "analytics:read",
  "learner:administer",
  "role:manage",
];
const FACULTY_GLOBAL: Action[] = ["course:create", "upload:courseAsset", "staff:access"];
const AUTHOR_OR_MODERATOR: Action[] = ["post:update", "post:delete", "comment:delete"];
const AUTHOR_ONLY: Action[] = ["comment:update"];
const ACTIVE_ENROLLMENT: Action[] = ["course:learn"];
const RESERVED: Action[] = ["billing:administer", "ai:administer"];
const FACULTY_OWNED: Action[] = ACTIONS.filter(
  (action) =>
    !ADMIN_ONLY.includes(action) &&
    !FACULTY_GLOBAL.includes(action) &&
    !AUTHOR_OR_MODERATOR.includes(action) &&
    !AUTHOR_ONLY.includes(action) &&
    !ACTIVE_ENROLLMENT.includes(action) &&
    !RESERVED.includes(action)
);

describe("the matrix is total", () => {
  it("classifies every action in the vocabulary exactly once", () => {
    const classified = [
      ...ADMIN_ONLY,
      ...FACULTY_GLOBAL,
      ...AUTHOR_OR_MODERATOR,
      ...AUTHOR_ONLY,
      ...ACTIVE_ENROLLMENT,
      ...RESERVED,
      ...FACULTY_OWNED,
    ];

    // If a new action is added without a test classification, this fails --
    // which is the point. An unclassified action would otherwise slip through
    // the exhaustive suites below untested.
    expect(classified.slice().sort()).toEqual(ACTIONS.slice().sort());
    expect(new Set(classified).size).toBe(ACTIONS.length);
  });
});

describe("ADMIN-only actions", () => {
  for (const action of ADMIN_ONLY) {
    it(`allows ADMIN and refuses everyone else for ${action}`, () => {
      expect(can(admin, action)).toBe(true);
      expect(can(faculty, action)).toBe(false);
      expect(can(student, action)).toBe(false);
    });

    it(`ignores ownership for ${action}`, () => {
      // These are global powers. Owning a Course must neither grant nor
      // withhold them.
      expect(can(otherAdmin, action, otherCourse)).toBe(true);
      expect(can(otherFaculty, action, ownedCourse)).toBe(false);
    });
  }
});

describe("faculty actions that need no resource", () => {
  for (const action of FACULTY_GLOBAL) {
    it(`allows FACULTY and ADMIN but refuses STUDENT for ${action}`, () => {
      expect(can(faculty, action)).toBe(true);
      expect(can(admin, action)).toBe(true);
      expect(can(student, action)).toBe(false);
    });
  }
});

describe("staff area access", () => {
  it("admits FACULTY and ADMIN and refuses STUDENT", () => {
    expect(can(faculty, "staff:access")).toBe(true);
    expect(can(admin, "staff:access")).toBe(true);
    expect(can(student, "staff:access")).toBe(false);
  });

  it("is only a shell key, not a grant of anything inside it", () => {
    // The bug this replaces: admin/layout.tsx gated on `isAdmin || isFaculty`,
    // and every page under it relied on that gate, so any FACULTY reached every
    // admin page. Holding the shell capability must imply nothing further.
    expect(can(faculty, "staff:access")).toBe(true);
    expect(can(faculty, "analytics:read")).toBe(false);
    expect(can(faculty, "learner:administer")).toBe(false);
    expect(can(faculty, "community:moderate")).toBe(false);
  });
});

describe("authoring actions require ownership", () => {
  for (const action of FACULTY_OWNED) {
    it(`allows the owning FACULTY for ${action}`, () => {
      expect(can(faculty, action, ownedCourse)).toBe(true);
    });

    it(`refuses a FACULTY who does not own the Course for ${action}`, () => {
      expect(can(otherFaculty, action, ownedCourse)).toBe(false);
      expect(can(faculty, action, otherCourse)).toBe(false);
    });

    it(`refuses an ADMIN who does not own the Course for ${action}`, () => {
      // The approved decision for #42: ownership is required for authoring even
      // for ADMIN, matching what DELETE /api/courses/[courseId] enforces today.
      // Widening this is #86's call, and this test is what makes that a
      // deliberate change rather than a drift.
      expect(can(admin, action, ownedCourse)).toBe(true);
      expect(can(otherAdmin, action, ownedCourse)).toBe(false);
    });

    it(`refuses a STUDENT who somehow owns the Course for ${action}`, () => {
      // Ownership never substitutes for the role.
      expect(can(asRole("STUDENT", OWNER), action, ownedCourse)).toBe(false);
    });

    it(`refuses ${action} when no resource is supplied`, () => {
      // Defaulting to the global resource must not accidentally satisfy an
      // ownership rule.
      expect(can(faculty, action)).toBe(false);
      expect(can(admin, action)).toBe(false);
    });
  }
});

describe("Module ownership", () => {
  const moduleOwnedViaCourse: Resource = {
    kind: "module",
    courseOwnerId: OWNER,
    assignedFacultyId: null,
  };
  const moduleAssigned: Resource = {
    kind: "module",
    courseOwnerId: OTHER,
    assignedFacultyId: ASSIGNED,
  };

  it("grants the Course creator", () => {
    expect(can(faculty, "topic:update", moduleOwnedViaCourse)).toBe(true);
  });

  it("grants the assigned faculty member of a Course they did not create", () => {
    // Assigned teaching is modelled separately from global administration,
    // which is the distinction #42 requires.
    expect(can(asRole("FACULTY", ASSIGNED), "topic:update", moduleAssigned)).toBe(true);
  });

  it("refuses a faculty member who is neither creator nor assignee", () => {
    expect(can(asRole("FACULTY", "user_stranger"), "topic:update", moduleAssigned)).toBe(false);
  });

  it("does not treat an unassigned Module as owned by an unrelated faculty member", () => {
    // `assignedFacultyId` is nullable. An unassigned Module belongs to its
    // Course creator and to nobody else.
    expect(
      can(asRole("FACULTY", "user_stranger"), "topic:update", {
        kind: "module",
        courseOwnerId: OTHER,
        assignedFacultyId: null,
      })
    ).toBe(false);

    expect(
      can(asRole("FACULTY", OTHER), "topic:update", {
        kind: "module",
        courseOwnerId: OTHER,
        assignedFacultyId: null,
      })
    ).toBe(true);
  });
});

describe("author-or-moderator actions", () => {
  const mine: Resource = { kind: "authored", authorId: OWNER };
  const theirs: Resource = { kind: "authored", authorId: OTHER };

  for (const action of AUTHOR_OR_MODERATOR) {
    it(`allows the author for ${action}`, () => {
      expect(can(student, action, mine)).toBe(true);
    });

    it(`refuses a non-author who is not a moderator for ${action}`, () => {
      expect(can(student, action, theirs)).toBe(false);
      expect(can(faculty, action, theirs)).toBe(false);
    });

    it(`allows a moderator to act on anyone's content for ${action}`, () => {
      expect(can(moderator, action, theirs)).toBe(true);
    });

    it(`refuses ${action} when the resource is not authored content`, () => {
      expect(can(student, action, ownedCourse)).toBe(false);
      expect(can(student, action)).toBe(false);
    });

    it(`does not match an empty author id for ${action}`, () => {
      // A real principal against content with no recorded author. The empty
      // *principal* id is covered by the deny-by-default block below; this is
      // the other half of the pair.
      expect(can(student, action, { kind: "authored", authorId: "" })).toBe(false);
    });
  }
});

describe("author-only actions", () => {
  const mine: Resource = { kind: "authored", authorId: OWNER };
  const theirs: Resource = { kind: "authored", authorId: OTHER };

  for (const action of AUTHOR_ONLY) {
    it(`allows the author for ${action}`, () => {
      expect(can(student, action, mine)).toBe(true);
    });

    it(`refuses a moderator for ${action}`, () => {
      // A moderator may remove a comment but not rewrite it: editing leaves
      // someone's name on words they did not write, and the person it happened
      // to cannot see that it did.
      expect(can(moderator, action, theirs)).toBe(false);
      expect(can(moderator, action, mine)).toBe(false);
    });

    it(`refuses a non-author of any role for ${action}`, () => {
      expect(can(student, action, theirs)).toBe(false);
      expect(can(faculty, action, theirs)).toBe(false);
    });
  }
});

describe("learner access to Course content", () => {
  for (const action of ACTIVE_ENROLLMENT) {
    it.each(["ACTIVE", "COMPLETED"])(`allows a %s Enrollment for ${action}`, (status) => {
      expect(can(student, action, { kind: "enrollment", status })).toBe(true);
    });

    it(`refuses a SUSPENDED Enrollment for ${action}`, () => {
      expect(can(student, action, { kind: "enrollment", status: "SUSPENDED" })).toBe(false);
      // Privilege does not buy back a suspension.
      expect(can(admin, action, { kind: "enrollment", status: "SUSPENDED" })).toBe(false);
    });

    it(`refuses an unrecognised Enrollment status for ${action}`, () => {
      for (const status of ["", "active", "PENDING", "REFUNDED"]) {
        expect(can(student, action, { kind: "enrollment", status })).toBe(false);
      }
    });

    it(`refuses ${action} when no Enrollment is supplied`, () => {
      expect(can(student, action)).toBe(false);
      expect(can(student, action, ownedCourse)).toBe(false);
    });
  }
});

describe("reserved actions", () => {
  for (const action of RESERVED) {
    it(`refuses every role for ${action} until its owning issue implements it`, () => {
      for (const principal of [student, faculty, admin]) {
        expect(can(principal, action)).toBe(false);
        expect(can(principal, action, ownedCourse)).toBe(false);
      }
    });
  }
});

describe("deny by default", () => {
  it("refuses an absent principal for every action", () => {
    for (const action of ACTIONS) {
      expect(can(null, action, ownedCourse)).toBe(false);
      expect(can(undefined, action, ownedCourse)).toBe(false);
    }
  });

  it("refuses a principal with an empty user id for every action", () => {
    // An unauthenticated caller produces an empty id. It must never match an
    // owner id, including an owner id that is itself empty.
    for (const action of ACTIONS) {
      expect(can({ userId: "", role: "ADMIN" }, action, { kind: "course", ownerId: "" })).toBe(false);
    }
  });

  it("refuses a role the domain does not define", () => {
    for (const corrupt of ["admin", "Admin", "SUPERUSER", "", " ADMIN ", 1, true, null, {}, []]) {
      const principal = { userId: OWNER, role: corrupt } as unknown as Principal;
      expect(can(principal, "analytics:read")).toBe(false);
      expect(can(principal, "course:update", ownedCourse)).toBe(false);
      expect(can(principal, "course:learn", { kind: "enrollment", status: "ACTIVE" })).toBe(false);
    }
  });

  it("refuses an action outside the vocabulary", () => {
    for (const unknown of ["course:destroy", "", "COURSE:UPDATE", "__proto__", "toString"]) {
      expect(can(admin, unknown as Action, ownedCourse)).toBe(false);
    }
  });

  it("does not resolve actions through the prototype chain", () => {
    // `RULES` is an object literal. Without a guard, `can(p, "toString")` could
    // find Object.prototype.toString and take an unintended branch.
    expect(can(admin, "constructor" as Action)).toBe(false);
    expect(can(admin, "hasOwnProperty" as Action)).toBe(false);
  });
});

describe("normalizeRole", () => {
  it("accepts exactly the three defined roles", () => {
    expect(normalizeRole("STUDENT")).toBe("STUDENT");
    expect(normalizeRole("FACULTY")).toBe("FACULTY");
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
  });

  it("rejects everything else", () => {
    for (const value of ["admin", "Faculty", " ADMIN", "", null, undefined, 0, {}, []]) {
      expect(normalizeRole(value)).toBeNull();
    }
  });
});

describe("isAction", () => {
  it("accepts every member of the vocabulary", () => {
    for (const action of ACTIONS) expect(isAction(action)).toBe(true);
  });

  it("rejects non-members, non-strings, and inherited properties", () => {
    for (const value of ["course:destroy", "", 1, null, undefined, {}, "toString", "__proto__"]) {
      expect(isAction(value)).toBe(false);
    }
  });
});
