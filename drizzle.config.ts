import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit is a CLI tool — not application code.
// process.env and dotenv are allowed here; src/env.ts covers application code only.
config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing — set it in .env.local");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
