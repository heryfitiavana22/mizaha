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

### Provider Abstraction

All external services are accessed through interfaces, never implementations:

```typescript
// CORRECT
import type { SearchProvider } from "@/lib/providers/interfaces/search";

// FORBIDDEN — breaks the abstraction
import { BraveSearchProvider } from "@/lib/providers/search/brave";
```

Primary → backup pairs: Brave→SerpAPI, Pappers/SIRENE (both active), Firecrawl→Playwright, Hunter→Apollo, Claude→OpenAI.

### Result Pattern

Every function that can fail returns `Result<T>` — never throws in business logic:

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: Error };
```

### Key Locations

| What                        | Where                                                           |
| --------------------------- | --------------------------------------------------------------- |
| DB schema (source of truth) | `src/lib/db/schema.ts`                                          |
| Env var declarations        | `src/env.ts` — never use `process.env` directly                 |
| LLM prompts                 | `src/lib/ai/prompts/` — never inline in code                    |
| Use case configs            | `src/lib/use-cases/` — only thing that changes per use case     |
| Generative UI catalogs      | `src/lib/ui-generative/catalog/`                                |
| Shared types                | `src/types/index.ts`                                            |
| Test utilities              | `src/tests/fixtures/`, `src/tests/mocks/`, `src/tests/helpers/` |

### Test File Naming

```text
discover.test.ts      → unit test
discover.int.test.ts  → integration test (real local DB, mocked providers)
```

No E2E tests — they cost real API credits.
