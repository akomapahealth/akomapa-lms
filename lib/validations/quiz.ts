import { z } from "zod";

import { COUNT, NUMBER } from "@/lib/http/limits";

import { resourceId } from "./ids";
import { requiredShortText } from "./text";

/**
 * Quiz, question, and submission bodies (#44).
 *
 * Quiz type is the enum the schema declares. The create route accepted any
 * string for it, so a quiz could be stored with a type no reader understands --
 * and `type` decides whether the post-test lock applies, so an unrecognised
 * value silently bypassed it.
 */
export const quizType = z.enum(["PRE_TEST", "POST_TEST", "MODULE_QUIZ"]);

export const quizCreateSchema = z
  .object({
    title: requiredShortText,
    type: quizType,
    moduleId: resourceId.nullish(),
  })
  .strict();

export const quizUpdateSchema = z
  .object({
    title: requiredShortText.optional(),
    type: quizType.optional(),
    timeLimitMinutes: z
      .number()
      .int()
      .min(1)
      .max(NUMBER.maxTimeLimitMinutes)
      .optional()
      .nullable(),
    passingScore: z.number().finite().min(0).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });

export const questionCreateSchema = z
  .object({ text: requiredShortText })
  .strict();

/**
 * One option in a question update.
 *
 * `id` present means "update this existing option"; absent means "create one".
 * The handler must still prove a supplied id belongs to the question being
 * edited -- a uuid from another question is a valid uuid.
 */
export const questionOptionSchema = z
  .object({
    id: resourceId.optional(),
    text: requiredShortText,
    isCorrect: z.boolean(),
    position: z.number().int().min(0).max(NUMBER.maxPosition),
  })
  .strict();

export const questionUpdateSchema = z
  .object({
    text: requiredShortText.optional(),
    points: z.number().int().min(0).max(NUMBER.maxPoints).optional(),
    options: z
      .array(questionOptionSchema)
      .max(COUNT.options)
      .refine(
        (options) => {
          const ids = options.flatMap((o) => (o.id === undefined ? [] : [o.id]));
          return new Set(ids).size === ids.length;
        },
        { message: "duplicate_option_id" }
      )
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "empty_update" });

export const submissionSchema = z
  .object({
    attemptId: resourceId,
    answers: z
      .array(
        z
          .object({
            questionId: resourceId,
            selectedOptionId: resourceId,
          })
          .strict()
      )
      // Bounded so a submission cannot be used to write an unlimited number of
      // rows. A Quiz with more questions than this cannot be graded here, which
      // is a deliberate ceiling rather than an accident.
      .max(COUNT.answers)
      // One answer per question. Duplicates would create two QuizAnswer rows for
      // one question and double-count the score.
      .refine(
        (answers) =>
          new Set(answers.map((a) => a.questionId)).size === answers.length,
        { message: "duplicate_question" }
      ),
  })
  .strict();
