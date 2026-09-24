# Mizaha

> **Mizaha** — Malagasy word meaning _"to search, to look, to examine"_.

A natural language-driven company search engine. The user describes what they're looking for in French, the system finds, qualifies, and presents matching companies or job offers with the right contact.

---

## Demo

<img src="demo/search.png" alt="Mizaha search criteria refinement interface" width="100%" />

<img src="demo/result.png" alt="Mizaha completed company search results" width="100%" />

## How It Works

```text
User types in natural language (French)
  ↓
[1. Interactive Chat]
  AI determines use case, extracts structured criteria
  json-render generates interactive UI (checkboxes, sliders)
  User refines criteria visually
  ↓
[2. Discover]
  Multi-source parallel: France Travail, WTTJ, SIRENE, Brave, FreeWork
  Deduplication by domain
  ↓
[3. Qualify]
  Firecrawl scrapes company sites → LLM scores vs criteria (≥ 0.5)
  For job offers: LLM scores posting content directly
  ↓
[4. Enrich]
  Extract contacts from scraped content (zero extra Firecrawl credits)
  Add company metadata from SIRENE/Pappers
  ↓
Results displayed via json-render (adaptive UI)
```

## Use Cases

| Use Case                          | Target     | Description                                 |
| --------------------------------- | ---------- | ------------------------------------------- |
| **UC1 — Freelance Client Search** | Companies  | Find French companies that need a developer |
| **UC2 — Job/Mission Search**      | Job offers | Find freelance missions or CDI/CDD postings |
| UC3 — Agency Prospecting (future) | Companies  | High-volume prospecting for agencies        |
| UC4 — B2B Sales (future)          | Companies  | Targeted lead generation with persona       |

Adding a new use case = one config file in `src/lib/use-cases/`. Nothing else changes.

## Tech Stack

| Layer               | Technology                            | Why                                          |
| ------------------- | ------------------------------------- | -------------------------------------------- |
| **Framework**       | Next.js (App Router) + Vercel AI SDK  | Streaming chat, industry standard            |
| **UI**              | shadcn/ui + AI Elements + json-render | AI-native components, generative UI          |
| **LLM**             | OpenAI API                            | Model-agnostic via Vercel AI SDK adapter     |
| **Database**        | PostgreSQL + pgvector (Docker)        | Relational + vector search                   |
| **ORM**             | Drizzle                               | TypeScript native, better pgvector support   |
| **Logging**         | pino                                  | Structured JSON (prod), human-readable (dev) |
| **Package Manager** | pnpm                                  | Fast, strict dependency resolution           |

## Provider Architecture

All external services are accessed through **TypeScript interfaces**, never implementations directly. Changing a provider = modifying one adapter file.

| Category           | Primary                                  | Backup             | Free Tier                 |
| ------------------ | ---------------------------------------- | ------------------ | ------------------------- |
| **Search**         | Brave Search                             | SerpAPI            | 2,000 req/month           |
| **Job Boards**     | France Travail, WTTJ (Algolia), FreeWork | —                  | Free / unlimited          |
| **Company Data**   | SIRENE (INSEE)                           | Pappers (disabled) | Free / unlimited          |
| **Scraper**        | Firecrawl                                | Playwright         | 500 credits (one-time)    |
| **Email/Contacts** | Firecrawl (composite)                    | Apollo.io          | Shares Firecrawl credits  |
| **LLM**            | Any via Vercel AI SDK                    | —                  | Model injected at runtime |

## Project Structure

```text
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Dashboard pages
│   └── api/                      # API routes (chat, pipeline, searches)
├── components/                   # UI components (chat, companies, jobs)
├── lib/
│   ├── ai/                       # LLM prompts + tools
│   ├── db/                       # Drizzle schema + migrations
│   ├── pipeline/                 # 4 pure steps + orchestrator
│   │   ├── steps/                # extract-criteria → discover → qualify → enrich
│   │   └── index.ts              # Orchestrator (the only place that knows step order)
│   ├── providers/                # Abstraction layer (NEVER BYPASS)
│   │   ├── interfaces/           # 6 TypeScript interfaces
│   │   └── [category]/           # Adapters (brave.ts, sirene.ts, firecrawl.ts, ...)
│   ├── use-cases/                # Config files per use case
│   └── ui-generative/            # json-render catalogs
└── types/                        # Shared TypeScript types
```

## Getting Started

### Prerequisites

- Node.js
- pnpm
- Docker (for PostgreSQL + pgvector)

### Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL + pgvector
pnpm db:start

# Run migrations
pnpm db:migrate

# Copy and configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development server
pnpm dev
```

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/mizaha

# LLM
OPENAI_API_KEY=

# Search
BRAVE_SEARCH_API_KEY=
SERP_API_KEY=

# Company data
PAPPERS_API_KEY=

# Job boards
FRANCE_TRAVAIL_CLIENT_ID=
FRANCE_TRAVAIL_CLIENT_SECRET=

# Scraping
FIRECRAWL_API_KEY=

# Email / Contacts (optional)
APOLLO_API_KEY=
```

### Commands

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript type check

# Database
pnpm db:start     # Start PostgreSQL + pgvector (Docker)
pnpm db:stop      # Stop the container
pnpm db:generate  # Generate migration from schema changes
pnpm db:migrate   # Apply pending migrations
pnpm db:studio    # Open Drizzle Studio

# Tests
pnpm test         # Unit tests
pnpm test:int     # Integration tests (requires Docker DB)
pnpm test:all     # All tests
```

## Error Strategy

The pipeline never crashes for partial errors:

1. **Provider fails** → automatically switches to backup if there is
2. **All providers for a step fail** → logs error, continues with what we have
3. **One company fails scraping** → skips it, continues the rest

## Documentation

All design decisions live in `docs/`:

| Doc                                       | Content                                        |
| ----------------------------------------- | ---------------------------------------------- |
| [`vision.md`](docs/vision.md)             | The idea, the problem solved, the future       |
| [`use-cases.md`](docs/use-cases.md)       | Use case definitions and examples              |
| [`architecture.md`](docs/architecture.md) | Pipeline, provider abstraction, error strategy |
| [`database.md`](docs/database.md)         | Full schema (21 tables)                        |
| [`providers.md`](docs/providers.md)       | Provider interfaces and free tier limits       |
| [`conventions.md`](docs/conventions.md)   | Code rules — applied without exception         |
| [`tech-stack.md`](docs/tech-stack.md)     | Technology decisions and rationale             |
| [`checklist.md`](docs/checklist.md)       | Build order phases 0–15                        |
