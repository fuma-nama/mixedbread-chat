import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Next.js loads `.env.local` for the app; deployments set variables directly.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
