import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

config();

const cliDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  ...(cliDatabaseUrl ? { datasource: { url: cliDatabaseUrl } } : {}),
  migrations: {
    path: path.join(__dirname, "prisma", "migrations"),
    seed: "tsx scripts/seed.ts",
  },
});
