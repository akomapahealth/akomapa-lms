import { describe, expect, it } from "vitest";

import { read, walk } from "../support/source-scan";

/**
 * The closed sets are written down once (#50).
 *
 * The schema declares the values and lib/domain/states.ts re-exports them with
 * their labels and rules. Before #50 the same lists lived in a policy union, an
 * entitlement constant, three zod enums, a role script, and four label maps --
 * which is how a value gets added in one place and silently mishandled in the
 * others. This scan fails the build if a list, a union, or a label map for one
 * of these sets is written out anywhere else.
 */

const CANONICAL = "lib/domain/states.ts";

const SOURCES = ["app", "actions", "components", "hooks", "lib", "scripts"]
  .flatMap((dir) => walk(dir, (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts")))
  .filter((file) => file !== CANONICAL);

/** Two or more members of one set, as a list, union, or zod enum. */
const SETS = {
  role: ["STUDENT", "FACULTY", "ADMIN"],
  enrollment: ["ACTIVE", "COMPLETED", "SUSPENDED"],
  quiz: ["PRE_TEST", "POST_TEST", "MODULE_QUIZ"],
  content: ["VIDEO", "TEXT", "INTERACTIVE"],
  badge: ["COMPLETION", "STREAK", "COMMUNITY", "QUIZ_SCORE", "MILESTONE"],
  theme: ["light", "dark", "system"],
} as const;

// The patterns are built from the fixed SETS constant above -- uppercase and
// lowercase identifiers with no regex metacharacters -- never from input,
// which is what the non-literal-regexp rule exists to catch.
function restatements(source: string, members: readonly string[]): string[] {
  const alternatives = members.join("|");
  const literal = `"(?:${alternatives})"`;
  const patterns = [
    // ["A", "B"] or z.enum(["A", "B"])
    // eslint-disable-next-line security/detect-non-literal-regexp -- constant input, see above
    new RegExp(`\\[\\s*${literal}\\s*,\\s*${literal}`, "g"),
    // "A" | "B"
    // eslint-disable-next-line security/detect-non-literal-regexp -- constant input, see above
    new RegExp(`${literal}\\s*\\|\\s*${literal}`, "g"),
    // { A: "Label", B: "Label" } -- a hand-written label map. Word-shaped
    // values only: an exhaustively typed icon map is presentation, not a
    // second copy of the vocabulary.
    // eslint-disable-next-line security/detect-non-literal-regexp -- constant input, see above
    new RegExp(`\\b(?:${alternatives}):\\s*"[A-Za-z][^"]*",\\s*(?:${alternatives}):`, "g"),
  ];
  return patterns.flatMap((pattern) => source.match(pattern) ?? []);
}

describe("closed-state values have one source", () => {
  it("scans the source tree", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
  });

  it.each(Object.entries(SETS))("no file restates the %s set", (_name, members) => {
    const offenders = SOURCES.flatMap((file) =>
      restatements(read(file), members).map((match) => `${file}: ${match}`)
    );

    expect(offenders).toEqual([]);
  });

  it("no file hard-codes a quiz-type label", () => {
    const offenders = SOURCES.filter((file) => /"(?:Pre-Test|Post-Test|Module Quiz)"/.test(read(file)));

    expect(offenders).toEqual([]);
  });

  it("no lookup falls back to printing the raw value", () => {
    // `labels[x] ?? x` existed only because the map was keyed by `string`.
    // Exhaustive Record<Enum, string> maps cannot miss.
    const offenders = SOURCES.filter((file) =>
      /(?:typeLabels|LABELS)\[[^\]]+\]\s*\?\?/.test(read(file))
    );

    expect(offenders).toEqual([]);
  });

  it("detects a restatement when one exists", () => {
    // The scan is only as good as its patterns, so prove each one fires.
    expect(restatements('const r = ["STUDENT", "ADMIN"];', SETS.role)).toHaveLength(1);
    expect(restatements('type T = "PRE_TEST" | "POST_TEST";', SETS.quiz)).toHaveLength(1);
    expect(restatements('z.enum(["light", "dark", "system"])', SETS.theme)).toHaveLength(1);
    expect(restatements('{ VIDEO: "Video", TEXT: "Text" }', SETS.content)).toHaveLength(1);
    expect(restatements('if (x === "ADMIN") return;', SETS.role)).toHaveLength(0);
    expect(restatements('{ STREAK: "🔥", COMMUNITY: "💬" }', SETS.badge)).toHaveLength(0);
  });
});
