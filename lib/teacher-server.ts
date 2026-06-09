export const isTeacherServer = async (userId?: string | null) => {
  if (!userId) return false;

  return userId === process.env.NEXT_PUBLIC_TEACHER_ID;
};
