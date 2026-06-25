import { z } from "zod";

export const topicUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  textContent: z.string().optional().nullable(),
  contentType: z.enum(["VIDEO", "TEXT", "INTERACTIVE"]).optional(),
  isFree: z.boolean().optional(),
}).strict();
