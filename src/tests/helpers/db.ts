import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function resetTestDb(): Promise<void> {
  // TRUNCATE all tables with CASCADE — covers FK dependencies and all 21 tables
  // Order doesn't matter with CASCADE. pgvector table included.
  await db.execute(sql`
    TRUNCATE TABLE
      "result_feedback",
      "outreach",
      "entity_tags",
      "tags",
      "user_entity_interactions",
      "entity_embeddings",
      "usage_logs",
      "contacts",
      "data_sources",
      "search_results",
      "pipeline_runs",
      "searches",
      "search_templates",
      "scheduled_searches",
      "entities",
      "organization_members",
      "subscriptions",
      "integrations",
      "api_keys",
      "organizations",
      "users"
    CASCADE
  `);
}
