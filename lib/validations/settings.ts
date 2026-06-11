import { z } from "zod";

export const settingsUpdateSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  defaultJournalPrivacy: z.boolean().optional(),
  showProfileInCommunity: z.boolean().optional(),
  emailOnBadgeEarned: z.boolean().optional(),
  emailOnForumReply: z.boolean().optional(),
  emailOnFacultyComment: z.boolean().optional(),
}).strict();
