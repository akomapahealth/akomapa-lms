import { z } from "zod";

export const quizUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(["PRE_TEST", "POST_TEST", "MODULE_QUIZ"]).optional(),
  timeLimitMinutes: z.number().int().min(1).optional().nullable(),
  passingScore: z.number().min(0).max(100).optional(),
}).strict();
