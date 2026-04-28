# Architecture

## Full Pipeline

```text
User types in natural language
  ↓
[Step 1 — Interactive Chat]
  json-render generates interactive components (checkboxes, sliders, etc.)
  User refines criteria visually
  Claude extracts structured criteria (JSON)
  ↓
[Step 2 — discover]
  Brave Search → list of company URLs
  Pappers / SIRENE → official French company data
  ↓
[Step 3 — qualify]
  Firecrawl scrapes each site
  Claude analyzes and assigns a relevance score + explanation
  ↓
[Step 4 — enrich]
  Hunter.io → right contact email
  Apollo → name, role, LinkedIn profile
  ↓
Results stored in database (companies, search_companies, contacts)
  ↓
[Dynamic display]
  json-render adapts the layout based on the search context
```

Each step is traced in `pipeline_runs` (step, status, duration, error if any).

---

## Generative UI (json-render)

json-render intervenes at two moments in the flow.

### Catalogs

```text
src/lib/ui-generative/
├── catalog/
│   ├── chat.ts      → allowed components in the chat (criteria)
│   └── results.ts   → allowed components for results display
```

**Chat catalog** — components for refining criteria:

- Checkboxes (sector, signals)
- Slider (company size, funding amount)
- Location selector
- Tech stack selector

**Results catalog** — components for displaying companies:

- Standard company card
- Funding timeline
- Tech stack badge
- Visual relevance score

### Rule

The AI can only use components defined in the catalog.
No component outside the catalog can be generated.

---

## Abstraction Layer (Providers)

This is the architectural core of the project. We depend on no tool directly.

### Interfaces

```text
src/lib/providers/interfaces/
├── search.ts      → SearchProvider
├── company.ts     → CompanyProvider
├── scraper.ts     → ScraperProvider
├── email.ts       → EmailProvider
└── llm.ts         → LLMProvider
```

### Implementations

```text
src/lib/providers/
├── search/
│   ├── brave.ts       → implements SearchProvider
│   └── serp.ts        → implements SearchProvider (backup)
├── company/
│   ├── pappers.ts     → implements CompanyProvider
│   └── sirene.ts      → implements CompanyProvider
├── scraper/
│   └── firecrawl.ts   → implements ScraperProvider
├── email/
│   ├── hunter.ts      → implements EmailProvider
│   └── apollo.ts      → implements EmailProvider (backup)
└── llm/
    └── vercel.ts      → implements LLMProvider — model injected at runtime
```

### Absolute Rule

Always import the interface, never the implementation directly.

```typescript
// CORRECT
import type { SearchProvider } from "@/lib/providers/interfaces/search";

// FORBIDDEN
import { BraveSearchProvider } from "@/lib/providers/search/brave";
```

The choice of implementation is made in a single configuration file, not in business logic.

---

## Pipeline Steps

Each step is independent and can be tested, replaced, or reordered without touching the others.

```text
src/lib/pipeline/
├── steps/
│   ├── extract-criteria.ts   → receives raw_query, returns SearchCriteria (JSON)
│   ├── discover.ts           → receives SearchCriteria, returns CompanyData[]
│   ├── qualify.ts            → receives CompanyData[], returns QualifiedCompany[]
│   └── enrich.ts             → receives QualifiedCompany[], returns EnrichedCompany[]
└── index.ts                  → orchestrator — step order + pipeline_runs
```

`index.ts` is the only place that knows the step order and traces execution.

---

## Use Cases

Each use case is a configuration, not different code.

```text
src/lib/use-cases/
├── freelance.ts   → which sources to activate, which signals, how to score
├── agency.ts      → (future)
└── index.ts       → registry, lookup by use case name
```

The pipeline receives the use case config and adapts. That's all.

---

## Error Strategy

### Three Levels

**Level 1 — Provider fails**
Automatically switch to backup without interrupting the pipeline.

```text
Brave Search fails → SerpAPI takes over
Hunter fails → Apollo takes over
```

**Level 2 — All providers for a step fail**
Log the error in `pipeline_runs` (step, error, status: failed).
Continue the pipeline with what we already have — no total crash.

**Level 3 — A company fails at scraping**
Skip it and continue with the other companies.
It is marked in `data_sources` with the error message.

### Absolute Rules

**Never crash the entire pipeline for a partial error.**
A pipeline that returns 8 results out of 10 is better than a pipeline that crashes.

---

## API Data Flow

```text
POST /api/pipeline
  → creates a search in database (status: pending)
  → triggers the pipeline in the background
  → returns search_id immediately

GET /api/searches/[id]
  → returns status and results if completed
```

The pipeline runs asynchronously (can take 1-5 minutes).
The frontend polls or uses a streaming mechanism to show progress.

---

## Company Deduplication

The same company can appear in multiple different searches.
The `companies` table is global and deduplicated by `domain`.

```text
New company found
  → Check if domain already exists in companies
  → If yes: update last_scraped_at and data
  → If no: create a new entry
  → In both cases: create an entry in search_companies
```

---

## Semantic Search (pgvector)

When we scrape a company, we generate an embedding of its description and content.
This embedding allows later to:

- Find companies similar to a liked company
- Improve scoring by semantic similarity
- Avoid re-scraping already known companies

Embeddings are stored in `company_embeddings` with `model_used` to allow changing the embedding model without losing old data.
