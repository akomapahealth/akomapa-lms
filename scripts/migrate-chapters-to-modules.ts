/**
 * Data migration script: Phase 1
 *
 * Run AFTER the Prisma schema migration that adds the Module table
 * and adds the nullable moduleId column to the Chapter table.
 *
 * This script:
 * 1. Creates a default "General" module for each course that has chapters
 * 2. Assigns all existing chapters to their course's default module
 * 3. Creates Enrollment records from existing Purchase records
 *
 * Usage: npx tsx scripts/migrate-chapters-to-modules.ts
 */

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

config();
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Starting Phase 1 data migration...\n");

  // 1. Create default modules for courses that have chapters without a moduleId
  const courses = await db.course.findMany({
    include: {
      modules: true,
    },
  });

  let modulesCreated = 0;
  let chaptersUpdated = 0;

  for (const course of courses) {
    // Skip if course already has modules
    if (course.modules.length > 0) {
      console.log(`  Course "${course.title}" already has modules, skipping.`);
      continue;
    }

    // Check if course has chapters that need migration
    // Use raw query since the schema now expects moduleId
    const chapters: { id: string }[] = await db.$queryRaw`
      SELECT id FROM "Chapter" WHERE "courseId" = ${course.id}
    `;

    if (chapters.length === 0) {
      console.log(`  Course "${course.title}" has no chapters, skipping.`);
      continue;
    }

    // Create default module
    const module = await db.module.create({
      data: {
        title: "General",
        courseId: course.id,
        position: 0,
        isPublished: true,
      },
    });
    modulesCreated++;
    console.log(`  Created module "General" for course "${course.title}"`);

    // Assign chapters to module using raw SQL
    // (since the Prisma schema may not have courseId on Topic anymore)
    const result = await db.$executeRaw`
      UPDATE "Chapter" SET "moduleId" = ${module.id} WHERE "courseId" = ${course.id}
    `;
    chaptersUpdated += Number(result);
    console.log(`  Assigned ${result} chapters to module`);
  }

  console.log(`\n  Modules created: ${modulesCreated}`);
  console.log(`  Chapters updated: ${chaptersUpdated}`);

  // 2. Create Enrollment records from Purchases
  const purchases = await db.purchase.findMany();
  let enrollmentsCreated = 0;

  for (const purchase of purchases) {
    // Check if enrollment already exists
    const existing = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: purchase.userId,
          courseId: purchase.courseId,
        },
      },
    });

    if (existing) continue;

    await db.enrollment.create({
      data: {
        userId: purchase.userId,
        courseId: purchase.courseId,
        status: "ACTIVE",
        enrolledAt: purchase.createdAt,
      },
    });
    enrollmentsCreated++;
  }

  console.log(`  Enrollments created: ${enrollmentsCreated}`);
  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
