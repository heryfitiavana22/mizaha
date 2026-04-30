import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  plan: text("plan").default("free"), // free | pro | enterprise
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// organizations
// ---------------------------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// organization_members
// ---------------------------------------------------------------------------
export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(), // admin | member
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// searches
// ---------------------------------------------------------------------------
export const searches = pgTable("searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  orgId: uuid("org_id").references(() => organizations.id), // nullable
  rawQuery: text("raw_query").notNull(),
  criteria: jsonb("criteria").notNull(),
  useCase: text("use_case").notNull(), // freelance-client | find-jobs | agency | ...
  status: text("status").default("pending"), // pending | running | completed | failed
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// search_templates
// ---------------------------------------------------------------------------
export const searchTemplates = pgTable("search_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(),
  useCase: text("use_case").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// scheduled_searches
// ---------------------------------------------------------------------------
export const scheduledSearches = pgTable("scheduled_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  templateId: uuid("template_id")
    .notNull()
    .references(() => searchTemplates.id),
  cronExpression: text("cron_expression").notNull(), // e.g.: "0 9 * * 1" (Monday 9am)
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// entities — central table, all discovered entities (companies, job offers, ...)
// Deduplicated by (type, dedup_key)
// ---------------------------------------------------------------------------
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // "company" | "job_offer" | "agency" | ...
    dedupKey: text("dedup_key").notNull(), // domain (company), url (job_offer), etc.
    data: jsonb("data").notNull(), // structure depends on type
    enrichedAt: timestamp("enriched_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [unique().on(table.type, table.dedupKey)],
);

// ---------------------------------------------------------------------------
// search_results — links a search to its results (one row per entity per search)
// ---------------------------------------------------------------------------
export const searchResults = pgTable("search_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id")
    .notNull()
    .references(() => searches.id),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  score: real("score").notNull(), // 0.0 to 1.0
  reason: text("reason").notNull(), // readable explanation
  status: text("status").default("new"), // new | viewed | contacted | dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// data_sources — which provider found what for each entity
// ---------------------------------------------------------------------------
export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  providerName: text("provider_name").notNull(), // brave | pappers | france_travail | wttj | firecrawl | ...
  rawData: jsonb("raw_data").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// user_entity_interactions
// ---------------------------------------------------------------------------
export const userEntityInteractions = pgTable("user_entity_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  searchId: uuid("search_id").references(() => searches.id), // nullable
  type: text("type").notNull(), // saved | blacklisted | viewed | contacted | dismissed
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// tags
// ---------------------------------------------------------------------------
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  name: text("name").notNull(),
  color: text("color"), // hex color code
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// entity_tags — junction entity ↔ tag
// ---------------------------------------------------------------------------
export const entityTags = pgTable("entity_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tags.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// outreach
// ---------------------------------------------------------------------------
export const outreach = pgTable("outreach", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id),
  message: text("message").notNull(),
  status: text("status").default("draft"), // draft | sent | replied
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// pipeline_runs
// ---------------------------------------------------------------------------
export const pipelineRuns = pgTable("pipeline_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id")
    .notNull()
    .references(() => searches.id),
  step: text("step").notNull(), // extract-criteria | discover | qualify | enrich
  status: text("status").notNull(), // running | completed | failed
  error: text("error"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// result_feedback
// ---------------------------------------------------------------------------
export const resultFeedback = pgTable("result_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  searchResultId: uuid("search_result_id")
    .notNull()
    .references(() => searchResults.id),
  rating: integer("rating").notNull(), // 1 to 5
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// integrations
// ---------------------------------------------------------------------------
export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  type: text("type").notNull(), // hubspot | pipedrive | salesforce | ...
  credentials: jsonb("credentials").notNull(), // stored encrypted
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// api_keys
// ---------------------------------------------------------------------------
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  keyHash: text("key_hash").notNull(), // never store the key in plain text
  name: text("name").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  plan: text("plan").notNull(), // free | pro | enterprise
  status: text("status").notNull(), // active | cancelled | past_due
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  stripeId: text("stripe_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// usage_logs
// ---------------------------------------------------------------------------
export const usageLogs = pgTable("usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  action: text("action").notNull(), // search | scrape | email_lookup | llm_call
  provider: text("provider"),
  creditsUsed: integer("credits_used").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// entity_embeddings — pgvector
// ---------------------------------------------------------------------------
export const entityEmbeddings = pgTable("entity_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  modelUsed: text("model_used").notNull(), // e.g.: text-embedding-3-small
  createdAt: timestamp("created_at").defaultNow(),
});
