import path from "node:path";
import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Load environment variables from .env file
config();

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL,
  },

  migrate: {
    async resolveSchema() {
      return {
        kind: "file",
        path: path.join(__dirname, "prisma", "schema.prisma"),
      };
    },
    async resolveDatasource() {
      return {
        url: process.env.DATABASE_URL!,
        directUrl: process.env.DIRECT_URL,
      };
    },
  },
});

