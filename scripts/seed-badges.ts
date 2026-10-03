import type { BadgeCriteria } from "../lib/badge-service";
import type { BadgeType } from "../lib/domain/states";

/**
 * The badges `npm run seed` creates.
 *
 * Kept apart from seed.ts so they can be typed and tested: `type` must be a
 * `BadgeType` and `criteria` a member of the rule union the badge service
 * validates (#50), and tests/unit/badge-service.test.ts asserts every one of
 * them parses.
 */
export const SEED_BADGES: readonly {
  name: string;
  description: string;
  type: BadgeType;
  criteria: BadgeCriteria;
}[] = [
  // Completion badges
  {
    name: "First Steps",
    description: "Complete your first topic",
    type: "COMPLETION",
    criteria: { type: "topics_completed", count: 1 },
  },
  {
    name: "Module Master",
    description: "Complete an entire module",
    type: "COMPLETION",
    criteria: { type: "modules_completed", count: 1 },
  },
  {
    name: "Course Champion",
    description: "Complete an entire course",
    type: "COMPLETION",
    criteria: { type: "courses_completed", count: 1 },
  },
  {
    name: "GHELP Graduate",
    description: "Complete all 10 GHELP courses",
    type: "MILESTONE",
    criteria: { type: "courses_completed", count: 10 },
  },

  // Ethics-specific badges
  {
    name: "Ethics Explorer",
    description: "Complete all ethics-related modules",
    type: "COMPLETION",
    criteria: { type: "category_completed", category: "Ethics & Values" },
  },
  {
    name: "Leadership Lens",
    description: "Complete all leadership modules",
    type: "COMPLETION",
    criteria: { type: "category_completed", category: "Leadership & Power" },
  },

  // Quiz badges
  {
    name: "Perfect Score",
    description: "Score 100% on any quiz",
    type: "QUIZ_SCORE",
    criteria: { type: "quiz_score", score: 100 },
  },
  {
    name: "Growth Mindset",
    description: "Improve your post-test score by 20%+ over your pre-test",
    type: "QUIZ_SCORE",
    criteria: { type: "score_improvement", minImprovement: 20 },
  },
  {
    name: "Quiz Conqueror",
    description: "Pass all quizzes in a course",
    type: "QUIZ_SCORE",
    criteria: { type: "all_quizzes_passed", scope: "course" },
  },

  // Streak badges
  {
    name: "Consistent Learner",
    description: "Maintain a 7-day learning streak",
    type: "STREAK",
    criteria: { type: "streak_days", count: 7 },
  },
  {
    name: "Dedicated Scholar",
    description: "Maintain a 30-day learning streak",
    type: "STREAK",
    criteria: { type: "streak_days", count: 30 },
  },

  // Community badges
  {
    name: "Community Voice",
    description: "Write 5 forum posts",
    type: "COMMUNITY",
    criteria: { type: "posts_created", count: 5 },
  },
  {
    name: "Thought Leader",
    description: "Receive 50 likes on your posts",
    type: "COMMUNITY",
    criteria: { type: "post_likes_received", count: 50 },
  },
  {
    name: "Mentor's Heart",
    description: "Help 10 other students by commenting on their posts",
    type: "COMMUNITY",
    criteria: { type: "comments_created", count: 10 },
  },
];
