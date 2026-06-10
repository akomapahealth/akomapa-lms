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
  } catch (error) {
    console.log("Error seeding the database", error);
    process.exit(1);
  } finally {
    await database.$disconnect();
  }
}

main();
