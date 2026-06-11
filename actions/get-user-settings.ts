import { db } from "@/lib/db";

export interface UserSettingsData {
  theme: string;
  defaultJournalPrivacy: boolean;
  showProfileInCommunity: boolean;
  emailOnBadgeEarned: boolean;
  emailOnForumReply: boolean;
  emailOnFacultyComment: boolean;
}

export const getUserSettings = async (
  userId: string
): Promise<UserSettingsData> => {
  try {
    const settings = await db.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        theme: "light",
        defaultJournalPrivacy: true,
        showProfileInCommunity: true,
        emailOnBadgeEarned: true,
        emailOnForumReply: true,
        emailOnFacultyComment: true,
      };
    }

    return {
      theme: settings.theme,
      defaultJournalPrivacy: settings.defaultJournalPrivacy,
      showProfileInCommunity: settings.showProfileInCommunity,
      emailOnBadgeEarned: settings.emailOnBadgeEarned,
      emailOnForumReply: settings.emailOnForumReply,
      emailOnFacultyComment: settings.emailOnFacultyComment,
    };
  } catch (error) {
    console.log("[GET_USER_SETTINGS]", error);
    return {
      theme: "light",
      defaultJournalPrivacy: true,
      showProfileInCommunity: true,
      emailOnBadgeEarned: true,
      emailOnForumReply: true,
      emailOnFacultyComment: true,
    };
  }
};
