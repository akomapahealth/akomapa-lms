import "server-only";

import { sanitizeRichText } from "@/lib/text/sanitize-html";

import type { CaseStudyScenario } from "./case-study-types";

/**
 * Sanitizes every rich-text field in a scenario.
 *
 * A scenario is a nested structure, and its narrative fields are rendered as
 * HTML while its other strings are rendered as text. Walking it in one place
 * means a new rich-text field is a change here rather than a forgotten call
 * site -- the failure mode that produced the original defect.
 *
 * Applied on read (before the scenario reaches the player) and on write (so
 * stored data is clean going forward). Read is the one that matters: rows
 * written before this existed are still untrusted.
 */
export function sanitizeScenario(scenario: CaseStudyScenario): CaseStudyScenario {
  return {
    ...scenario,
    introduction: sanitizeRichText(scenario.introduction),
    conclusion: sanitizeRichText(scenario.conclusion),
    steps: scenario.steps.map((step) => ({
      ...step,
      narrative: sanitizeRichText(step.narrative),
      // `question`, and each choice's text, consequence, and feedback, render
      // as JSX text nodes, which React escapes. They are deliberately left
      // alone: sanitizing them would silently rewrite legitimate characters
      // such as a "<" in "n < 30".
    })),
  };
}
