# Database Schema

Database: **PostgreSQL + pgvector**
ORM: **Drizzle**
Local dev: **Docker** (image `pgvector/pgvector:pg16`)

---

## Tables Overview

| Table                      | Role                                                                | Status         |
| -------------------------- | ------------------------------------------------------------------- | -------------- |
| `users`                    | User accounts                                                       | Schema created |
| `organizations`            | Teams / agencies                                                    | Schema created |
| `organization_members`     | Org members                                                         | Schema created |
| `searches`                 | Each search launched                                                | Active         |
| `search_templates`         | Reusable searches                                                   | Active         |
| `scheduled_searches`       | Recurring searches                                                  | Schema created |
| `entities`                 | All discovered entities (companies, job offers, ...) — deduplicated | Active         |
| `search_results`           | Results of a search — links search ↔ entity with score              | Active         |
| `data_sources`             | Which provider found what, for which entity                         | Active         |
| `contacts`                 | Contacts found for an entity                                        | Active         |
| `user_entity_interactions` | Saved, blacklist, viewed, etc.                                      | Active         |
| `tags`                     | User labels                                                         | Schema created |
| `entity_tags`              | Junction entity ↔ tag                                               | Schema created |
| `outreach`                 | Sent message tracking                                               | Schema created |
| `pipeline_runs`            | Execution traceability                                              | Active         |
| `result_feedback`          | Result relevance rating                                             | Schema created |
| `integrations`             | External CRM connections                                            | Schema created |
| `api_keys`                 | API keys for external access                                        | Schema created |
| `subscriptions`            | SaaS billing                                                        | Schema created |
| `usage_logs`               | Billing and limits                                                  | Schema created |
| `entity_embeddings`        | pgvector vectors per entity                                         | Active         |

---

## Detailed Tables

### `users`

```text
id           uuid        PK
email        text        unique not null
name         text        not null
plan         text        default 'free'   -- free | pro | enterprise
created_at   timestamp   default now()
```

---

### `organizations`

```text
id           uuid        PK
name         text        not null
created_at   timestamp   default now()
```

---

### `organization_members`

```text
id           uuid        PK
org_id       uuid        FK → organizations
user_id      uuid        FK → users
role         text        not null   -- admin | member
created_at   timestamp   default now()
```

---

### `searches`

Each search launched by a user.

```text
id           uuid        PK
user_id      uuid        FK → users (nullable)
org_id       uuid        FK → organizations (nullable)
raw_query    text        not null   -- what the user typed
criteria     jsonb       not null   -- JSON extracted by the LLM
use_case     text        not null   -- freelance-client | find-jobs | agency | ...
status       text        default 'pending'   -- pending | running | completed | failed
created_at   timestamp   default now()
```

---

### `search_templates`

Saved and reusable searches.

```text
id           uuid        PK
user_id      uuid        FK → users (nullable)
name         text        not null
criteria     jsonb       not null
use_case     text        not null
created_at   timestamp   default now()
```

---

### `scheduled_searches`

Automatic recurring searches.

```text
id                uuid        PK
user_id           uuid        FK → users
template_id       uuid        FK → search_templates
cron_expression   text        not null   -- e.g.: "0 9 * * 1" (Monday 9am)
last_run_at       timestamp
next_run_at       timestamp
active            boolean     default true
created_at        timestamp   default now()
```

---

### `entities`

**The central table.** All discovered entities — companies, job offers, agencies, and any future type.
Deduplicated by `(type, dedup_key)`. The same entity is never stored twice.

```text
id            uuid        PK
type          text        not null   -- "company" | "job_offer" | "agency" | ...
dedup_key     text        not null   -- domain (company), url (job_offer), linkedin_url, etc.
data          jsonb       not null   -- all entity data — structure depends on type
enriched_at   timestamp              -- last time data was enriched
created_at    timestamp   default now()

UNIQUE(type, dedup_key)
```

**`data` structure by type:**

```json
// type = "company"
{
  "name": "Acme SAS",
  "website": "https://acme.fr",
  "domain": "acme.fr",
  "description": "...",
  "sector": "SaaS",
  "location": "Paris",
  "employee_count": 42,
  "tech_stack": ["React", "Node.js"],
  "funding": { "amount": 2000000, "round": "Seed", "date": "2023-01" }
}

// type = "job_offer"
{
  "title": "Développeur React Senior",
  "company_name": "Acme SAS",
  "company_domain": "acme.fr",
  "location": "Paris",
  "contract_type": "CDI",
  "remote": true,
  "tech_stack": ["React", "TypeScript"],
  "description": "...",
  "url": "https://welcometothejungle.com/jobs/123",
  "posted_at": "2024-01-15"
}
```

Adding a new entity type = just use a new `type` value and define its `data` structure. No migration needed.

---

### `search_results`

Links a search to its results. One row per entity found in a search.

```text
id            uuid        PK
search_id     uuid        FK → searches
entity_id     uuid        FK → entities
score         float       not null   -- 0.0 to 1.0
reason        text        not null   -- readable explanation
status        text        default 'new'   -- new | viewed | contacted | dismissed
created_at    timestamp   default now()
```

---

### `data_sources`

Tracks which provider provided what data for each entity.
Essential for debugging and comparing provider quality.

```text
id              uuid        PK
entity_id       uuid        FK → entities
provider_name   text        not null   -- brave | pappers | france_travail | wttj | firecrawl | ...
raw_data        jsonb       not null   -- raw data returned by the provider
fetched_at      timestamp   default now()
```

---

### `contacts`

Contacts found for an entity (CTO, founder, hiring manager, etc.)

```text
id            uuid        PK
entity_id     uuid        FK → entities
name          text        not null
title         text
email         text
linkedin_url  text
created_at    timestamp   default now()
```

---

### `user_entity_interactions`

Unifies all user interactions on any entity.

```text
id            uuid        PK
user_id       uuid        FK → users (nullable)
entity_id     uuid        FK → entities
search_id     uuid        FK → searches (nullable)
type          text        not null   -- saved | blacklisted | viewed | contacted | dismissed
metadata      jsonb       default '{}'   -- notes, reason, etc.
created_at    timestamp   default now()
```

---

### `tags`

Labels created by the user to organize entities.

```text
id            uuid        PK
user_id       uuid        FK → users (nullable)
name          text        not null
color         text        -- hex color code
created_at    timestamp   default now()
```

---

### `entity_tags`

```text
id            uuid        PK
entity_id     uuid        FK → entities
tag_id        uuid        FK → tags
created_at    timestamp   default now()
```

---

### `outreach`

Tracking sent messages.

```text
id            uuid        PK
user_id       uuid        FK → users
contact_id    uuid        FK → contacts
message       text        not null
status        text        default 'draft'   -- draft | sent | replied
sent_at       timestamp
created_at    timestamp   default now()
```

---

### `pipeline_runs`

Traces each pipeline execution step.

```text
id            uuid        PK
search_id     uuid        FK → searches
step          text        not null   -- extract-criteria | discover | qualify | enrich
status        text        not null   -- running | completed | failed
error         text
duration_ms   integer
created_at    timestamp   default now()
```

---

### `result_feedback`

User rates whether a result was relevant or not.

```text
id                uuid        PK
user_id           uuid        FK → users (nullable)
search_result_id  uuid        FK → search_results
rating            integer     not null   -- 1 to 5
reason            text
created_at        timestamp   default now()
```

---

### `integrations`

```text
id            uuid        PK
org_id        uuid        FK → organizations
type          text        not null   -- hubspot | pipedrive | salesforce | ...
credentials   jsonb       not null   -- stored encrypted
active        boolean     default true
created_at    timestamp   default now()
```

---

### `api_keys`

```text
id            uuid        PK
user_id       uuid        FK → users
key_hash      text        not null
name          text        not null
last_used_at  timestamp
expires_at    timestamp
created_at    timestamp   default now()
```

---

### `subscriptions`

```text
id              uuid        PK
org_id          uuid        FK → organizations
plan            text        not null   -- free | pro | enterprise
status          text        not null   -- active | cancelled | past_due
period_start    timestamp
period_end      timestamp
stripe_id       text
created_at      timestamp   default now()
```

---

### `usage_logs`

```text
id              uuid        PK
user_id         uuid        FK → users (nullable)
action          text        not null   -- search | scrape | email_lookup | llm_call
provider        text
credits_used    integer     default 1
created_at      timestamp   default now()
```

---

### `entity_embeddings`

Embedding vectors for semantic search via pgvector.

```text
id            uuid        PK
entity_id     uuid        FK → entities
embedding     vector(1536)
model_used    text        not null
created_at    timestamp   default now()
```

`model_used` is stored to allow changing the embedding model without invalidating old data.

---

## Key Relations

```text
users ──< organization_members >── organizations
users ──< searches
organizations ──< searches
searches ──< search_results >── entities
searches ──< pipeline_runs
entities ──< contacts
entities ──< data_sources
entities ──< entity_embeddings
entities ──< user_entity_interactions
entities ──< entity_tags >── tags
search_results ──< result_feedback
contacts ──< outreach
organizations ──< integrations
organizations ──< subscriptions
users ──< api_keys
users ──< usage_logs
```
