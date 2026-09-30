import { z } from "zod";

import { COUNT, TEXT } from "@/lib/http/limits";

import { caseStudyScenarioSchema } from "@/lib/case-study-types";

import { resourceId } from "./ids";
import { shortText, title } from "./text";

/**
 * Case study bodies (#44).
 *
 * The scenario itself is validated by `caseStudyScenarioSchema` and then
 * sanitized by `lib/case-study-sanitize.ts` before storage. What was missing was
 * a schema for the envelope: `topicId`, `title`, and `description` were read
 * straight off the body, so `description` could be any size and `topicId` any
 * string.
 */
export const caseStudyCreateSchema = z
  .object({
    topicId: resourceId,
    title,
    description: shortText.optional(),
    scenario: caseStudyScenarioSchema,
  })
  .strict();

export const caseStudyUpdateSchema = z
  .object({
    title: title.optional(),
    description: shortText.optional(),
    scenario: caseStudyScenarioSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });

/**
 * A learner's run through a case study.
 *
 * `choices` was stored as an unvalidated JSON blob of any shape or size. It is
 * the learner's own record, so the contents are theirs, but it still needs a
 * ceiling and a known structure.
 */
export const caseStudyAttemptSchema = z
  .object({
    /**
     * The choice ids the learner picked, in order.
     *
     * `case-study-player.tsx` holds this as `useState<string[]>` and posts it
     * as-is, so the stored shape is a flat array of choice ids -- not
     * step/choice pairs. Bounded rather than reshaped: changing the stored shape
     * would orphan every existing row, and #85 owns the authoring and
     * persistence rework where that migration belongs.
     */
    choices: z.array(z.string().trim().min(1).max(TEXT.token)).max(COUNT.scenarioSteps),
    completed: z.boolean().optional(),
  })
  .strict();
