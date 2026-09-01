import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

const clerkAuth = vi.hoisted(() => vi.fn());
const nav = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    // Next's redirect throws to unwind the render. Modelling that matters: a
    // guard that merely *called* redirect and then carried on would still leak
    // the page it was meant to protect.
    throw new Error(`REDIRECT:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth }));
vi.mock("next/navigation", () => nav);
vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const {
  getStaffCapabilities,
  requirePageCapability,
  requirePageCourse,
  requirePagePrincipal,
} = await import("@/lib/auth/page");

/**
 * Page-level authorization.
 *
 * The bug these replace: `admin/layout.tsx` gated on "FACULTY or better" and
 * seven of the nine pages under it had no check of their own, so any faculty
 * member reached every administration page. Each page now declares what it
 * needs, and the tests below are written from the denied direction.
 */
function signedInAs(userId: string | null, role?: string) {
  clerkAuth.mockResolvedValue({ userId });
  dbMock.user.findUnique.mockResolvedValue(role ? { role } : null);
}

beforeEach(() => {
  signedInAs("user_1", "FACULTY");
});

describe("requirePagePrincipal", () => {
  it("returns the principal when there is a session", async () => {
    await expect(requirePagePrincipal()).resolves.toEqual({
      userId: "user_1",
      role: "FACULTY",
    });
  });

  it("sends an anonymous visitor to sign in by default", async () => {
    signedInAs(null);

    await expect(requirePagePrincipal()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("honours the destination the page's old guard used", async () => {
    // Several pages sent an anonymous visitor to /dashboard rather than
    // /sign-in. Preserving each destination keeps the seam behaviour-neutral.
    signedInAs(null);

    await expect(requirePagePrincipal("/dashboard")).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("does not check any capability, so a learner passes", async () => {
    signedInAs("user_1", "STUDENT");

    await expect(requirePagePrincipal()).resolves.toMatchObject({ role: "STUDENT" });
  });
});

describe("requirePageCapability", () => {
  it("returns the principal when the capability is held", async () => {
    signedInAs("user_1", "ADMIN");

    await expect(requirePageCapability("analytics:read")).resolves.toEqual({
      userId: "user_1",
      role: "ADMIN",
    });
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("sends an anonymous visitor to sign in", async () => {
    signedInAs(null);

    await expect(requirePageCapability("staff:access")).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("sends a learner away from the staff area", async () => {
    signedInAs("user_1", "STUDENT");

    await expect(requirePageCapability("staff:access")).rejects.toThrow("REDIRECT:/dashboard");
  });

  it.each(["analytics:read", "learner:administer", "community:moderate"] as const)(
    "sends a FACULTY away from %s",
    async (action) => {
      // The regression for the leak. Holding the staff shell key must not admit
      // a faculty member to an ADMIN-only page.
      await expect(requirePageCapability(action)).rejects.toThrow("REDIRECT:/dashboard");
    }
  );

  it("still admits a FACULTY to the staff shell itself", async () => {
    await expect(requirePageCapability("staff:access")).resolves.toMatchObject({
      role: "FACULTY",
    });
  });
});

describe("requirePageCourse", () => {
  it("returns the Course when the principal owns it", async () => {
    dbMock.course.findFirst.mockResolvedValue({ id: "course_1", userId: "user_1" });

    const { course, principal } = await requirePageCourse("quiz:read", "course_1");

    expect(course).toMatchObject({ id: "course_1" });
    expect(principal.userId).toBe("user_1");
    expect(dbMock.course.findFirst).toHaveBeenCalledWith({
      where: { id: "course_1", userId: "user_1" },
    });
  });

  it("renders not-found for a Course owned by someone else", async () => {
    // The ownership filter means no row comes back. Rendering a distinct
    // "forbidden" page instead would confirm the Course exists.
    dbMock.course.findFirst.mockResolvedValue(null);

    await expect(requirePageCourse("quiz:read", "course_9")).rejects.toThrow("NOT_FOUND");
  });

  it("renders not-found for a Course that does not exist, indistinguishably", async () => {
    dbMock.course.findFirst.mockResolvedValue(null);

    await expect(requirePageCourse("quiz:read", "missing")).rejects.toThrow("NOT_FOUND");
  });

  it("sends an anonymous visitor to sign in without querying", async () => {
    signedInAs(null);

    await expect(requirePageCourse("quiz:read", "course_1")).rejects.toThrow("REDIRECT:/sign-in");
    expect(dbMock.course.findFirst).not.toHaveBeenCalled();
  });

  it("renders not-found for a learner rather than revealing the Course exists", async () => {
    signedInAs("user_1", "STUDENT");

    await expect(requirePageCourse("quiz:read", "course_1")).rejects.toThrow("NOT_FOUND");
  });

  it("propagates a genuine fault instead of reporting it as not-found", async () => {
    // A database outage is not an authorization answer.
    dbMock.course.findFirst.mockRejectedValue(new Error("connection reset"));

    await expect(requirePageCourse("quiz:read", "course_1")).rejects.toThrow("connection reset");
    expect(nav.notFound).not.toHaveBeenCalled();
  });
});

describe("getStaffCapabilities", () => {
  it("grants an ADMIN everything", async () => {
    signedInAs("user_1", "ADMIN");

    await expect(getStaffCapabilities()).resolves.toEqual({
      canAccessStaffArea: true,
      canModerateCommunity: true,
      canReadAnalytics: true,
      canAdministerLearners: true,
    });
  });

  it("grants a FACULTY the shell and nothing else", async () => {
    // This is what the navigation renders. Showing Students, Community, or
    // Analytics to a faculty member offers links that bounce them on click.
    await expect(getStaffCapabilities()).resolves.toEqual({
      canAccessStaffArea: true,
      canModerateCommunity: false,
      canReadAnalytics: false,
      canAdministerLearners: false,
    });
  });

  it("grants a STUDENT nothing", async () => {
    signedInAs("user_1", "STUDENT");

    await expect(getStaffCapabilities()).resolves.toEqual({
      canAccessStaffArea: false,
      canModerateCommunity: false,
      canReadAnalytics: false,
      canAdministerLearners: false,
    });
  });

  it("grants an anonymous visitor nothing, without querying", async () => {
    signedInAs(null);

    const capabilities = await getStaffCapabilities();

    expect(Object.values(capabilities).every((value) => value === false)).toBe(true);
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });
});
