-- Make moduleId required on Chapter table
-- Run AFTER: npx tsx scripts/migrate-chapters-to-modules.ts

-- Make moduleId NOT NULL (all chapters should have been assigned to a module by now)
ALTER TABLE "Chapter" ALTER COLUMN "moduleId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old courseId foreign key and column (no longer needed - course is derived via module)
ALTER TABLE "Chapter" DROP CONSTRAINT IF EXISTS "Chapter_courseId_fkey";
DROP INDEX IF EXISTS "Chapter_courseId_idx";
ALTER TABLE "Chapter" DROP COLUMN IF EXISTS "courseId";
