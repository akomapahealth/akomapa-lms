import { z } from "zod";

import { ThemePreference } from "@/lib/domain/states";

export const settingsUpdateSchema = z.object({
  theme: z.nativeEnum(ThemePreference).optional(),
  defaultJournalPrivacy: z.boolean().optional(),
  showProfileInCommunity: z.boolean().optional(),
  emailOnBadgeEarned: z.boolean().optional(),
  emailOnForumReply: z.boolean().optional(),
  emailOnFacultyComment: z.boolean().optional(),
}).strict();
