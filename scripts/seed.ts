import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config();
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Add it to .env or .env.local before running the seed script."
  );
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const database = new PrismaClient({ adapter });

async function main() {
  try {
    await database.category.createMany({
      data: [
        { name: "Ethics & Values" },
        { name: "Leadership & Power" },
        { name: "Community Health" },
        { name: "Research & Data" },
        { name: "Systems Thinking" },
        { name: "Sustainability" },
        { name: "Interprofessional Practice" },
        { name: "Advocacy & Governance" },
      ],
      skipDuplicates: true,
    });

    console.log("Seeded GHELP categories successfully.");

    await database.forumCategory.createMany({
      data: [
        { name: "General Discussion", description: "Open conversation about anything GHELP-related", color: "#0097b2", position: 0 },
        { name: "Ethics & Values", description: "Discuss ethical dilemmas and values in global health", color: "#ebb92b", position: 1 },
        { name: "Case Studies", description: "Share and analyze real-world case studies", color: "#10b981", position: 2 },
        { name: "Introductions", description: "Introduce yourself to the GHELP community", color: "#8b5cf6", position: 3 },
        { name: "Course Help", description: "Ask questions about course material", color: "#f59e0b", position: 4 },
        { name: "Career & Mentorship", description: "Career guidance and mentorship connections", color: "#ec4899", position: 5 },
      ],
      skipDuplicates: true,
    });

    console.log("Seeded forum categories successfully.");

    await database.badge.createMany({
      data: [
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
      ],
      skipDuplicates: true,
    });

    console.log("Seeded badges successfully.");
  } catch (error) {
    console.log("Error seeding the database", error);
    process.exit(1);
  } finally {
    await database.$disconnect();
  }
}

main();
