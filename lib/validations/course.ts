import { z } from "zod";

export const courseUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
}).strict();
