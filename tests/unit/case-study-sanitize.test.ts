import { describe, expect, it } from "vitest";

import { sanitizeScenario } from "@/lib/case-study-sanitize";
import type { CaseStudyScenario } from "@/lib/case-study-types";

/**
 * Every rich-text field in a scenario, and only those.
 *
 * The original defect was three call sites rendering HTML with nothing in
 * between. Walking the structure in one place is what stops a fourth field
 * being added later without one.
 */
const scenario = (overrides: Partial<CaseStudyScenario> = {}): CaseStudyScenario => ({
  introduction: "<p>Intro</p>",
  conclusion: "<p>Outro</p>",
  steps: [
    {
      id: "step_1",
      narrative: "<p>Narrative</p>",
      question: "What now?",
      choices: [
        { id: "c1", text: "A", consequence: "X", ethicalScore: 80, feedback: "good" },
        { id: "c2", text: "B", consequence: "Y", ethicalScore: 20, feedback: "bad" },
      ],
    },
  ],
  ...overrides,
});

describe("sanitizeScenario", () => {
  it("cleans the introduction", () => {
    const clean = sanitizeScenario(scenario({ introduction: "<script>alert(1)</script><p>hi</p>" }));

    expect(clean.introduction).toBe("<p>hi</p>");
  });

  it("cleans the conclusion", () => {
    const clean = sanitizeScenario(scenario({ conclusion: '<img src=x onerror="alert(1)">done' }));

    expect(clean.conclusion).not.toMatch(/onerror/i);
  });

  it("cleans every step's narrative, not only the first", () => {
    const dirty = scenario();
    dirty.steps = [
      { ...dirty.steps[0], id: "a", narrative: "<p>ok</p>" },
      { ...dirty.steps[0], id: "b", narrative: "<svg onload=alert(1)>" },
    ];

    const clean = sanitizeScenario(dirty);

    expect(clean.steps[1].narrative).not.toMatch(/onload|<svg/i);
  });

  it("preserves legitimate formatting", () => {
    const clean = sanitizeScenario(
      scenario({ introduction: "<h2>Title</h2><p><strong>bold</strong></p>" })
    );

    expect(clean.introduction).toBe("<h2>Title</h2><p><strong>bold</strong></p>");
  });

  it("leaves the fields that render as text alone", () => {
    // These reach JSX text nodes, where React escapes them. Sanitizing would
    // silently rewrite legitimate characters, such as the "<" in "n < 30".
    const dirty = scenario();
    dirty.steps[0].question = "Is n < 30 acceptable?";
    dirty.steps[0].choices[0].feedback = "Consider n < 30 & the power calculation";

    const clean = sanitizeScenario(dirty);

    expect(clean.steps[0].question).toBe("Is n < 30 acceptable?");
    expect(clean.steps[0].choices[0].feedback).toBe("Consider n < 30 & the power calculation");
  });

  it("preserves structure and identifiers", () => {
    const clean = sanitizeScenario(scenario());

    expect(clean.steps).toHaveLength(1);
    expect(clean.steps[0].id).toBe("step_1");
    expect(clean.steps[0].choices).toHaveLength(2);
    expect(clean.steps[0].choices[1].ethicalScore).toBe(20);
  });
});
