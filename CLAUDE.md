# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

- Never add `Co-Authored-By: Claude ...` or any AI attribution trailer to commit messages.

---

## Source of Truth

`docs/` is the authoritative reference. **Always read the relevant doc files before touching any code.** When a decision changes, update the corresponding doc file before or alongside the code change. When this file (`CLAUDE.md`) becomes stale — new phases completed, commands added, architecture decisions made — update it.

Key files:

- `docs/conventions.md` — code rules, applied without exception
- `docs/architecture.md` — pipeline, provider abstraction, error strategy
- `docs/database.md` — full schema (21 tables)
- `docs/checklist.md` — build order phases 0–15; check off items as they are completed
- `docs/tech-stack.md` — all technology decisions and why; update if a tool is added, replaced, or changed
- `docs/providers.md` — provider interfaces and free tier limits; update if a provider changes
- `docs/use-cases.md` — use case definitions, qualifying signals, French query examples
- `docs/project-structure.md` — canonical directory layout and `.env.example` template

---

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm lint         # ESLint

# Database (once Phase 3 is set up)
docker compose up -d                          # start PostgreSQL + pgvector
pnpm drizzle-kit generate                     # generate migration from schema
pnpm drizzle-kit migrate                      # apply migrations

# Tests (once Phase 14 is set up — Vitest)
pnpm test                                     # run all unit tests
pnpm test src/lib/pipeline/steps/discover     # run a single test file
pnpm test --reporter=verbose                  # verbose output
```

Commit format (commitlint enforces this): `<type>(<scope>): <description>`
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

---

## Architecture

### The Pipeline

Four sequential pure functions, orchestrated exclusively by `src/lib/pipeline/index.ts`:

```text
extract-criteria → discover → qualify → enrich
```

- **Steps** (`src/lib/pipeline/steps/`) receive typed input, return `Result<T>`, have zero side effects — no DB writes, no direct API calls.
- **Orchestrator** (`pipeline/index.ts`) is the only place that knows step order, writes to DB, updates `pipeline_runs`, and handles provider fallbacks.

### Async API Flow

The pipeline runs in the background (1–5 minutes). The API never blocks:

```text
POST /api/pipeline  → creates search (status: pending), triggers pipeline async, returns search_id immediately
GET  /api/searches/[id] → returns status + results; frontend polls until status = completed
```

### Provider Abstraction

All external services are accessed through interfaces, never implementations:

```typescript
// CORRECT
import type { SearchProvider } from "@/lib/providers/interfaces/search";

// FORBIDDEN — breaks the abstraction
import { BraveSearchProvider } from "@/lib/providers/search/brave";
```

Primary → backup pairs: Brave→SerpAPI, Pappers/SIRENE (both active), Firecrawl→Playwright, Hunter→Apollo, Claude→OpenAI.

### Error Strategy

Three levels — never crash the full pipeline for a partial error:

1. **Provider fails** → automatically switch to backup (e.g. Brave → SerpAPI)
2. **All providers for a step fail** → log to `pipeline_runs`, continue with what we have
3. **One company fails scraping** → skip it, mark error in `data_sources`, continue the rest

### Result Pattern

Every function that can fail returns `Result<T>` — never throws in business logic:

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: Error };
```

### Generative UI (json-render)

json-render is used at two points. The AI can only use components defined in a catalog — no improvisation:

- `src/lib/ui-generative/catalog/chat.ts` — interactive criteria refinement (checkboxes, sliders, selectors)
- `src/lib/ui-generative/catalog/results.ts` — adaptive results display (company cards, funding timeline, score)

### Use Case Config Pattern

The pipeline is identical for all use cases. Adding a new use case means creating one config file in `src/lib/use-cases/` and registering it in `index.ts`. The pipeline, providers, and DB do not change.

### Logging

Use `pino` for all structured logging (JSON in prod, pino-pretty in dev). Log every external API call with provider name, duration, and status. Do not use `console.log`.

### Key Locations

| What                        | Where                                                           |
| --------------------------- | --------------------------------------------------------------- |
| DB schema (source of truth) | `src/lib/db/schema.ts`                                          |
| Env var declarations        | `src/env.ts` — never use `process.env` directly                 |
| LLM prompts                 | `src/lib/ai/prompts/` — never inline in code                    |
| Vercel AI SDK tool defs     | `src/lib/ai/tools/`                                             |
| Use case configs            | `src/lib/use-cases/` — only thing that changes per use case     |
| Generative UI catalogs      | `src/lib/ui-generative/catalog/`                                |
| Shared types                | `src/types/index.ts`                                            |
| Test utilities              | `src/tests/fixtures/`, `src/tests/mocks/`, `src/tests/helpers/` |

### Test File Naming

Tests live in a `__tests__/` subfolder within the module they test (not a top-level test dir):

```text
src/lib/pipeline/steps/__tests__/discover.test.ts      → unit test
src/lib/pipeline/steps/__tests__/discover.int.test.ts  → integration test (real local DB, mocked providers)
```

No E2E tests — they cost real API credits.
