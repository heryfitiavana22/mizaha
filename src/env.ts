import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DATABASE_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    BRAVE_SEARCH_API_KEY: z.string().min(1),
    PAPPERS_API_KEY: z.string().min(1),
    FIRECRAWL_API_KEY: z.string().min(1),
    HUNTER_API_KEY: z.string().min(1),
    APOLLO_API_KEY: z.string().optional(),
    SERP_API_KEY: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
    PAPPERS_API_KEY: process.env.PAPPERS_API_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    HUNTER_API_KEY: process.env.HUNTER_API_KEY,
    APOLLO_API_KEY: process.env.APOLLO_API_KEY,
    SERP_API_KEY: process.env.SERP_API_KEY,
  },
});
