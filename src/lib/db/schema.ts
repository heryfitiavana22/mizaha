import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
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
  useCase: text("use_case").notNull(), // freelance | agency | commercial | ...
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
// companies — global, deduplicated by domain
// ---------------------------------------------------------------------------
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  domain: text("domain").unique().notNull(), // deduplication key
  description: text("description"),
  sector: text("sector"),
  location: text("location"),
  employeeCount: integer("employee_count"),
  techStack: jsonb("tech_stack").default([]),
  funding: jsonb("funding").default({}), // { amount, date, round, investors }
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// search_companies — junction search ↔ company
// ---------------------------------------------------------------------------
export const searchCompanies = pgTable("search_companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id")
    .notNull()
    .references(() => searches.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  relevanceScore: real("relevance_score").notNull(), // 0.0 to 1.0
  relevanceReason: text("relevance_reason").notNull(),
  status: text("status").default("new"), // new | viewed | contacted | dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// data_sources — which provider found what for each company
// ---------------------------------------------------------------------------
export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  providerName: text("provider_name").notNull(), // brave | pappers | sirene | firecrawl | ...
  rawData: jsonb("raw_data").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---------------------------------------------------------------------------
// user_company_interactions
// ---------------------------------------------------------------------------
export const userCompanyInteractions = pgTable("user_company_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // nullable in MVP
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
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
// company_tags — junction company ↔ tag
// ---------------------------------------------------------------------------
export const companyTags = pgTable("company_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
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
  searchCompanyId: uuid("search_company_id")
    .notNull()
    .references(() => searchCompanies.id),
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
// company_embeddings — pgvector
// ---------------------------------------------------------------------------
export const companyEmbeddings = pgTable("company_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  modelUsed: text("model_used").notNull(), // e.g.: text-embedding-3-small
  createdAt: timestamp("created_at").defaultNow(),
});
