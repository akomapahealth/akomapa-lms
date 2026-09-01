import { describe, expect, it } from "vitest";

import { isCourseComplete, isModuleComplete } from "@/lib/courses/completion";

/**
 * Completion decides whether a certificate is issued, which is the product's
 * only externally verifiable claim. The rule that matters most is the negative
 * one: emptiness is not completion.
 *
 * Before #40 both checks were a bare `.every()`. `[].every()` is `true`, so a
 * Course with no published Topics -- a draft, or one whose Topics had all been
 * unpublished -- reported complete, marked the Enrollment COMPLETED, and issued
 * a certificate for finishing nothing.
 */
const done = (id: string) => ({ id, completed: true });
const pending = (id: string) => ({ id, completed: false });

describe("isModuleComplete", () => {
  it("is false for a Module with no published Topics", () => {
    expect(isModuleComplete({ topics: [] }, "topic_1")).toBe(false);
  });

  it("is true when every Topic is done", () => {
    expect(isModuleComplete({ topics: [done("a"), done("b")] }, "none")).toBe(true);
  });

  it("is false when any Topic is outstanding", () => {
    expect(isModuleComplete({ topics: [done("a"), pending("b")] }, "none")).toBe(false);
  });

  it("counts the Topic being completed right now", () => {
    // The progress write and this read are separate statements, so the row for
    // the Topic just completed may still show its old value.
    expect(isModuleComplete({ topics: [done("a"), pending("b")] }, "b")).toBe(true);
  });

  it("does not count a Topic id that is not in the Module", () => {
    // A mismatched id must not be able to complete a Module it has nothing to
    // do with.
    expect(isModuleComplete({ topics: [pending("a")] }, "topic_from_elsewhere")).toBe(false);
  });

  it("is true for a single completed Topic", () => {
    expect(isModuleComplete({ topics: [pending("a")] }, "a")).toBe(true);
  });
});

describe("isCourseComplete", () => {
  it("is false for a Course with no Modules", () => {
    expect(isCourseComplete([], "topic_1")).toBe(false);
  });

  it("is false for a Course whose Modules hold no published Topics", () => {
    // The vacuous case that issued certificates for empty Courses.
    expect(isCourseComplete([{ topics: [] }, { topics: [] }], "topic_1")).toBe(false);
  });

  it("is true when every Topic across every Module is done", () => {
    expect(
      isCourseComplete([{ topics: [done("a")] }, { topics: [done("b"), done("c")] }], "none")
    ).toBe(true);
  });

  it("is false when one Topic in one Module is outstanding", () => {
    expect(
      isCourseComplete([{ topics: [done("a")] }, { topics: [done("b"), pending("c")] }], "none")
    ).toBe(false);
  });

  it("counts the Topic being completed right now", () => {
    expect(
      isCourseComplete([{ topics: [done("a")] }, { topics: [pending("b")] }], "b")
    ).toBe(true);
  });

  it("ignores an empty Module rather than letting it block or manufacture completion", () => {
    // Counting Topics rather than Modules means a Module that happens to hold
    // no published Topics does neither.
    expect(isCourseComplete([{ topics: [done("a")] }, { topics: [] }], "none")).toBe(true);
  });

  it("does not let a Topic from another Course complete this one", () => {
    expect(isCourseComplete([{ topics: [pending("a")] }, { topics: [pending("b")] }], "foreign"))
      .toBe(false);
  });
});
