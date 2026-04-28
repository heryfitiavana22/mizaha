# Database Schema

Database: **PostgreSQL + pgvector**
ORM: **Drizzle**
Local dev: **Docker** (image `pgvector/pgvector:pg16`)

---

## Tables Overview

| Table                       | Role                             | MVP                      |
| --------------------------- | -------------------------------- | ------------------------ |
| `users`                     | User accounts                    | Schema created, not used |
| `organizations`             | Teams / agencies                 | Schema created, not used |
| `organization_members`      | Org members                      | Schema created, not used |
| `searches`                  | Each search launched             | Active                   |
| `search_templates`          | Reusable searches                | Active                   |
| `scheduled_searches`        | Recurring searches               | Schema created, not used |
| `companies`                 | Companies (global, deduplicated) | Active                   |
| `search_companies`          | Junction search ↔ company        | Active                   |
| `data_sources`              | Which provider found what        | Active                   |
| `contacts`                  | Contacts per company             | Active                   |
| `user_company_interactions` | Saved, blacklist, viewed, etc.   | Active                   |
| `tags`                      | User labels                      | Schema created           |
| `company_tags`              | Junction company ↔ tag           | Schema created           |
| `outreach`                  | Sent message tracking            | Schema created, not used |
| `pipeline_runs`             | Execution traceability           | Active                   |
| `result_feedback`           | Result relevance rating          | Schema created           |
| `integrations`              | External CRM connections         | Schema created, not used |
| `api_keys`                  | API keys for external access     | Schema created, not used |
| `subscriptions`             | SaaS billing                     | Schema created, not used |
| `usage_logs`                | Billing and limits               | Schema created           |
| `company_embeddings`        | pgvector vectors                 | Active                   |

---

## Detailed Tables

### `users`

User accounts. Not used in MVP (personal use, no login).

```text
id           uuid        PK
email        text        unique not null
name         text        not null
plan         text        default 'free'   -- free | pro | enterprise
created_at   timestamp   default now()
```

---

### `organizations`

Agencies or teams with multiple members. Not used in MVP.

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
user_id      uuid        FK → users (nullable in MVP)
org_id       uuid        FK → organizations (nullable)
raw_query    text        not null   -- what the user typed
criteria     jsonb       not null   -- JSON extracted by the LLM
use_case     text        not null   -- freelance | agency | commercial | ...
status       text        default 'pending'   -- pending | running | completed | failed
created_at   timestamp   default now()
```

---

### `search_templates`

Saved and reusable searches.

```text
id           uuid        PK
user_id      uuid        FK → users (nullable in MVP)
name         text        not null
criteria     jsonb       not null
use_case     text        not null
created_at   timestamp   default now()
```

---

### `scheduled_searches`

Automatic recurring searches (e.g.: rerun every Monday).

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

### `companies`

Global company table. **Deduplicated by domain.**
The same company exists only once, even if found in multiple searches.

```text
id              uuid        PK
name            text        not null
website         text
domain          text        unique not null   -- deduplication key
description     text
sector          text
location        text
employee_count  integer
tech_stack      jsonb       default '[]'
funding         jsonb       default '{}'     -- { amount, date, round, investors }
last_scraped_at timestamp
created_at      timestamp   default now()
```

---

### `search_companies`

Junction between a search and found companies.
Allows a company to appear in multiple searches with different scores.

```text
id                uuid        PK
search_id         uuid        FK → searches
company_id        uuid        FK → companies
relevance_score   float       not null   -- 0.0 to 1.0
relevance_reason  text        not null   -- readable explanation generated by Claude
status            text        default 'new'   -- new | viewed | contacted | dismissed
created_at        timestamp   default now()
```

---

### `data_sources`

Tracks which provider provided what data for each company.
Essential for debugging and comparing provider quality.

```text
id              uuid        PK
company_id      uuid        FK → companies
provider_name   text        not null   -- brave | pappers | sirene | firecrawl | ...
raw_data        jsonb       not null   -- raw data returned by the provider
fetched_at      timestamp   default now()
```

---

### `contacts`

Contacts found for a company (CTO, founder, etc.)

```text
id            uuid        PK
company_id    uuid        FK → companies
name          text        not null
title         text
email         text
linkedin_url  text
created_at    timestamp   default now()
```

---

### `user_company_interactions`

Unifies all user interactions on a company.
Replaces separate tables (saved, blacklisted, viewed) with a flexible, extensible system.

```text
id            uuid        PK
user_id       uuid        FK → users (nullable in MVP)
company_id    uuid        FK → companies
search_id     uuid        FK → searches (nullable — interaction outside a search possible)
type          text        not null   -- saved | blacklisted | viewed | contacted | dismissed
metadata      jsonb       default '{}'   -- notes, reason, etc.
created_at    timestamp   default now()
```

---

### `tags`

Labels created by the user to organize companies.

```text
id            uuid        PK
user_id       uuid        FK → users (nullable in MVP)
name          text        not null
color         text        -- hex color code
created_at    timestamp   default now()
```

---

### `company_tags`

```text
id            uuid        PK
company_id    uuid        FK → companies
tag_id        uuid        FK → tags
created_at    timestamp   default now()
```

---

### `outreach`

Tracking sent messages. The human sends, the system tracks.

```text
id            uuid        PK
user_id       uuid        FK → users
contact_id    uuid        FK → contacts
message       text        not null   -- draft generated by Claude or written manually
status        text        default 'draft'   -- draft | sent | replied
sent_at       timestamp
created_at    timestamp   default now()
```

---

### `pipeline_runs`

Traces each pipeline execution step.
Essential for debugging, measuring performance, identifying failing steps.

```text
id            uuid        PK
search_id     uuid        FK → searches
step          text        not null   -- extract-criteria | discover | qualify | enrich
status        text        not null   -- running | completed | failed
error         text        -- error message if failed
duration_ms   integer     -- duration in milliseconds
created_at    timestamp   default now()
```

---

### `result_feedback`

User rates whether a result was relevant or not.
Feeds LLM scoring improvement over time.

```text
id                    uuid        PK
user_id               uuid        FK → users (nullable in MVP)
search_company_id     uuid        FK → search_companies
rating                integer     not null   -- 1 to 5
reason                text        -- optional explanation
created_at            timestamp   default now()
```

---

### `integrations`

Connections to external CRMs (HubSpot, Pipedrive, Salesforce). Future.

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

API keys for external access when the product becomes a platform.

```text
id            uuid        PK
user_id       uuid        FK → users
key_hash      text        not null   -- never store the key in plain text
name          text        not null   -- readable label
last_used_at  timestamp
expires_at    timestamp
created_at    timestamp   default now()
```

---

### `subscriptions`

SaaS subscriptions. Future.

```text
id              uuid        PK
org_id          uuid        FK → organizations
plan            text        not null   -- free | pro | enterprise
status          text        not null   -- active | cancelled | past_due
period_start    timestamp
period_end      timestamp
stripe_id       text        -- Stripe subscription ID
created_at      timestamp   default now()
```

---

### `usage_logs`

Tracks each costly action for billing and plan limits.

```text
id              uuid        PK
user_id         uuid        FK → users (nullable in MVP)
action          text        not null   -- search | scrape | email_lookup | llm_call
provider        text        -- which provider was called
credits_used    integer     default 1
created_at      timestamp   default now()
```

---

### `company_embeddings`

Embedding vectors for semantic search via pgvector.

```text
id            uuid        PK
company_id    uuid        FK → companies
embedding     vector(1536)   -- dimension depends on the model used
model_used    text        not null   -- model name (e.g.: text-embedding-3-small)
created_at    timestamp   default now()
```

`model_used` is stored to allow changing the embedding model without invalidating old data.

---

## Key Relations

```text
users ──< organization_members >── organizations
users ──< searches
organizations ──< searches
searches ──< search_companies >── companies
searches ──< pipeline_runs
companies ──< contacts
companies ──< data_sources
companies ──< company_embeddings
companies ──< user_company_interactions
companies ──< company_tags >── tags
search_companies ──< result_feedback
contacts ──< outreach
organizations ──< integrations
organizations ──< subscriptions
users ──< api_keys
users ──< usage_logs
```
