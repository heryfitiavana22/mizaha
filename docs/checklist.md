# Build Checklist — Mizaha

> **For the Claude instance building this project:**
> Read ALL files in `docs/` before touching any code.
> This checklist is the build order. Do not skip phases. Do not reorder steps.
> When in doubt: check `docs/conventions.md` first.

---

## Conventions to apply everywhere (non-negotiable)

Before coding anything, internalize these — they apply to every single file:

- **Convention 1**: Functions return `Result<T>`, never `throw` in business logic
- **Convention 2**: Always use object parameters `({ param1, param2 }: Options)`
- **Convention 3**: No `any` — use `unknown` and validate
- **Convention 4**: Pipeline steps are pure functions — no DB writes, no API calls except through providers
- **Convention 8**: One component per file, kebab-case filename, named export (never default)
- **Convention 10**: Functions max ~30 lines, single responsibility
- **Convention 12**: Early return — no nested ifs

Full list: `docs/conventions.md`

---

## Phase 0 — Online Verification (before any code)

Knowledge has an expiration date. Verify these tools before implementing against them.

- [x] **json-render** (`json-render.dev`) — existe, packages `@json-render/core @json-render/react @json-render/shadcn`, requiert Zod v4
- [x] **AI Elements** (`elements.ai-sdk.dev`) — existe, `ai-elements` v1.9.0, compatible AI SDK v6
- [x] **Streamdown** (`streamdown.ai`) — existe, v2.1.0, `npm i streamdown`
- [x] **Firecrawl** — ⚠️ 500 crédits one-time (pas mensuel) — docs/providers.md mis à jour
- [x] **Hunter.io** — 25 searches + 50 verifications/mois, confirmé
- [x] **Pappers** — ⚠️ 100 req/mois (pas "généreux") — docs/providers.md mis à jour
- [x] **@t3-oss/env-nextjs** — toujours recommandé, v0.13.0
- [x] **Vercel AI SDK** — v6 stable actuel, v7 en beta, pas de breaking changes majeurs
- [x] **Drizzle ORM + pgvector** — `vector()` column stable depuis drizzle-orm@0.31.0

> If any tool has changed significantly: update `docs/tech-stack.md` before continuing.
> If a tool no longer exists: discuss before picking a replacement.

---

## Phase 1 — Project Bootstrap

- [x] Initialize project: `pnpm create next-app mizaha --typescript --app --tailwind --eslint --src-dir`
- [x] Verify `tsconfig.json` has `"strict": true`
- [x] Configure **Prettier** — create `.prettierrc`
- [x] Configure **ESLint** — strict TypeScript rules, no `any` (`@typescript-eslint/no-explicit-any: error`)
- [x] Install and configure **Husky**: `pnpm add -D husky lint-staged && pnpm husky init`
- [x] Configure **lint-staged** in `package.json` — run ESLint + Prettier on staged files only
- [x] Install and configure **commitlint**: `pnpm add -D @commitlint/cli @commitlint/config-conventional`
- [x] Create `.commitlintrc.json` with `{ "extends": ["@commitlint/config-conventional"] }`
- [x] Add commitlint to Husky commit-msg hook
- [x] Install **pino + pino-pretty**: `pnpm add pino && pnpm add -D pino-pretty`
- [x] Create `src/lib/logger.ts` — singleton pino logger (JSON in prod, pino-pretty in dev)
- [x] First commit: `chore(setup): initialize next.js project with tooling`

---

## Phase 2 — Environment Variables

- [x] Copy `.env.example` from `docs/project-structure.md` → create actual `.env.example`
- [x] Create `.env.local` (never commit this file — add to `.gitignore`)
- [x] Install `@t3-oss/env-nextjs` and `zod`: `pnpm add @t3-oss/env-nextjs zod`
- [x] Create `src/env.ts` — declare and validate all env vars (see example in `docs/tech-stack.md`)
- [x] Import `env` from `src/env.ts` everywhere env vars are needed — **never use `process.env` directly**

---

## Phase 3 — Docker + Database

- [x] Create `docker-compose.yml` (port 5434 — local conflict avoidance)
- [x] Start the container: `docker compose up -d`
- [x] Install Drizzle: `pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit`
- [x] Create `drizzle.config.ts` (dotenv loads .env.local — drizzle-kit ne le charge pas nativement)
- [x] Create `src/lib/db/index.ts` — PostgreSQL connection client
- [x] Create `src/lib/db/schema.ts` — 21 tables traduites depuis `docs/database.md`
  - `CREATE EXTENSION IF NOT EXISTS vector;` ajouté en tête de migration
  - `vector('embedding', { dimensions: 1536 })` pour company_embeddings
  - Toutes les tables "Schema created, not used" créées
- [x] Run first migration: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
- [x] Verify schema in DB — 21 tables + extension vector confirmées

---

## Phase 4 — Shared Types

- [x] Create `src/types/index.ts` — define all shared types used across the project:
  - `Result<T>` type (see `docs/conventions.md` §1)
  - `SearchCriteria`, `CompanyData`, `QualifiedCompany`, `EnrichedCompany`
  - `Contact`, `QualificationResult`, `SearchResult`, `ScrapedContent`
  - (Derive from `docs/providers.md` — all types defined in the interfaces section)

---

## Phase 5 — Provider Interfaces

Create the 5 interface files. **These are contracts — do not add implementation details here.**

- [x] `src/lib/providers/interfaces/search.ts` — `SearchProvider`, `SearchOptions`, `SearchResult`
- [x] `src/lib/providers/interfaces/company.ts` — `CompanyProvider`, `CompanyCriteria`, `CompanyData`
- [x] `src/lib/providers/interfaces/scraper.ts` — `ScraperProvider`, `ScrapedContent`
- [x] `src/lib/providers/interfaces/email.ts` — `EmailProvider`, `Contact`
- [x] `src/lib/providers/interfaces/llm.ts` — `LLMProvider`, `SearchCriteria`, `QualificationResult`

Reference: `docs/providers.md` — all interface definitions are there verbatim.

---

## Phase 6 — Provider Adapters (MVP only)

For each adapter:

- Implement the interface (no extra public methods)
- Use `Result<T>` for all methods that can fail
- Log each API call with pino (provider name, duration, status)
- Never import another adapter — only the interface

### Search

- [x] `src/lib/providers/search/brave.ts` — implements `SearchProvider`
  - Call Brave Search API
  - Return `Result<SearchResult[]>`

### Company (French data)

- [x] `src/lib/providers/company/pappers.ts` — implements `CompanyProvider`
- [x] `src/lib/providers/company/sirene.ts` — implements `CompanyProvider`
  - SIRENE is the official free French registry (INSEE)

### Scraper

- [x] `src/lib/providers/scraper/firecrawl.ts` — implements `ScraperProvider`
  - 500 credits/month free — log each use

### Email

- [x] `src/lib/providers/email/hunter.ts` — implements `EmailProvider`
  - 25 req/month free — **very limited**, log every call

### LLM

- [x] `src/lib/providers/llm/vercel.ts` — implements `LLMProvider`
  - Use Vercel AI SDK (`generateObject` + `generateText`)
  - Model injected at runtime — switching LLM = changing one argument in use case config
  - All 3 methods: `extractCriteria`, `qualify`, `generateDraft`

---

## Phase 7 — AI Prompts

Prompts are never written inline in code. They live here and are imported.

- [x] `src/lib/ai/prompts/extract-criteria.ts`
  - Input: `rawQuery` (natural language) + `useCase`
  - Output: structured `SearchCriteria` JSON
  - Must handle French queries (see examples in `docs/use-cases.md`)

- [x] `src/lib/ai/prompts/qualify.ts`
  - Input: company data + criteria
  - Output: `{ score: 0.0-1.0, reason: string, matchedSignals: string[] }`

- [x] `src/lib/ai/prompts/generate-draft.ts`
  - Input: contact + company context
  - Output: personalized outreach message draft

---

## Phase 8 — Use Case Configuration

- [x] `src/lib/use-cases/freelance.ts` — MVP use case config:
  - Which signals to look for (see `docs/use-cases.md` §1)
  - Which providers to activate (Brave + Pappers/SIRENE + Firecrawl + Hunter + Claude)
  - Scoring weights

- [x] `src/lib/use-cases/index.ts` — registry:

  ```typescript
  export function getUseCase({ name }: { name: string }): UseCaseConfig { ... }
  ```

---

## Phase 9 — Pipeline Steps

Each step = one pure function. No DB writes. No provider calls except through the interface.
Input and output types come from `src/types/index.ts`.

- [x] `src/lib/pipeline/steps/extract-criteria.ts`
  - Signature: `extractCriteria({ rawQuery, useCase, llm }: Options): Promise<Result<SearchCriteria>>`
  - Calls the LLM prompt

- [x] `src/lib/pipeline/steps/discover.ts`
  - Signature: `discover({ criteria, search, company }: Options): Promise<Result<CompanyData[]>>`
  - Calls search provider + company provider
  - Returns merged, deduplicated list

- [x] `src/lib/pipeline/steps/qualify.ts`
  - Signature: `qualify({ companies, criteria, scraper, llm }: Options): Promise<Result<QualifiedCompany[]>>`
  - Calls scraper then LLM for each company
  - **Error level 3**: if one company fails scraping, skip it and continue

- [x] `src/lib/pipeline/steps/enrich.ts`
  - Signature: `enrich({ companies, email }: Options): Promise<Result<EnrichedCompany[]>>`
  - Calls email provider for each company

---

## Phase 10 — Pipeline Orchestrator

- [ ] `src/lib/pipeline/index.ts` — **the only place that knows step order**

  Must do all of the following:
  - Accept a `searchId` and `useCase`
  - Update `searches.status` in DB (pending → running → completed/failed)
  - For each step: write a `pipeline_runs` row (step, status: running)
  - On step success: update `pipeline_runs` (status: completed, duration_ms)
  - On step failure: update `pipeline_runs` (status: failed, error)
  - **Error level 1**: if primary provider fails, try backup automatically
  - **Error level 2**: if all providers for a step fail, log and continue with what we have
  - **Never crash the whole pipeline for a partial error**
  - Write results to DB: `companies` (deduplicated by domain), `search_companies`, `contacts`, `data_sources`
  - Company deduplication: check if `domain` exists, update `last_scraped_at` if yes, insert if no
  - Update `searches.status = 'completed'` at the end

---

## Phase 11 — Generative UI Catalogs

- [ ] `src/lib/ui-generative/catalog/chat.ts` — allowed components in the criteria chat:
  - Checkboxes (sector, signals)
  - Slider (company size, funding)
  - Location selector
  - Tech stack selector

- [ ] `src/lib/ui-generative/catalog/results.ts` — allowed components for results display:
  - Company card (standard)
  - Funding timeline
  - Tech stack badges
  - Relevance score visual

> Only components defined in these catalogs can be generated by the AI. No improvisation outside the catalog.

---

## Phase 12 — API Routes

- [ ] `src/app/api/chat/route.ts` — streaming chat endpoint (Vercel AI SDK)
  - Uses `LLMProvider.extractCriteria` to extract criteria from conversation
  - Responds with json-render components (from `catalog/chat.ts`) for interactive refinement
  - Stream the response

- [ ] `src/app/api/pipeline/route.ts` — trigger pipeline
  - `POST`: creates a `searches` row (status: pending), triggers pipeline **in the background**, returns `search_id` immediately
  - The pipeline is async — can take 1-5 minutes

- [ ] `src/app/api/searches/route.ts`
  - `GET /api/searches` — list all searches

- [ ] `src/app/api/searches/[id]/route.ts`
  - `GET /api/searches/[id]` — return search status + results (used by frontend to poll)

---

## Phase 13 — Frontend

### Pages

- [ ] `src/app/(dashboard)/searches/new/page.tsx` — new search, chat interface
- [ ] `src/app/(dashboard)/searches/[id]/page.tsx` — results of a specific search
  - Polls `GET /api/searches/[id]` until status = completed
- [ ] `src/app/(dashboard)/companies/page.tsx` — global company view
- [ ] `src/app/layout.tsx` — root layout

### Components

> Convention 8: one component per file, kebab-case filename, named export.

**Chat components** (`src/components/chat/`):

- [ ] `chat-input.tsx` — natural language input field
- [ ] `chat-message.tsx` — single message display
- [ ] `criteria-display.tsx` — shows extracted criteria
- [ ] `json-render-wrapper.tsx` — wraps json-render for interactive criteria

**Company components** (`src/components/companies/`):

- [ ] `company-card.tsx` — single company card
- [ ] `company-list.tsx` — list of company cards
- [ ] `relevance-score.tsx` — visual score display
- [ ] `contact-info.tsx` — contact name, email, LinkedIn

**UI base** (`src/components/ui/`):

- [ ] Install shadcn/ui: `pnpm dlx shadcn@latest init`
- [ ] Add needed components (button, card, badge, slider, etc.)

---

## Phase 14 — Tests

Reference: `docs/conventions.md` §9

### Unit tests (pure functions first — no mocks needed)

- [ ] `src/lib/pipeline/steps/__tests__/extract-criteria.test.ts`
- [ ] `src/lib/pipeline/steps/__tests__/discover.test.ts`
- [ ] `src/lib/pipeline/steps/__tests__/qualify.test.ts`
- [ ] `src/lib/pipeline/steps/__tests__/enrich.test.ts`
- [ ] `src/lib/utils/__tests__/` — test each utility function

### Unit tests with HTTP mocks (provider adapters)

- [ ] `src/lib/providers/search/__tests__/brave.test.ts` — mock Brave API response
- [ ] `src/lib/providers/company/__tests__/pappers.test.ts`
- [ ] `src/lib/providers/scraper/__tests__/firecrawl.test.ts`
- [ ] `src/lib/providers/email/__tests__/hunter.test.ts`

### Integration tests (real local DB, mocked providers)

- [ ] `src/lib/pipeline/__tests__/pipeline.int.test.ts`
  - Uses the real local DB (Docker)
  - Mocks all external providers
  - Runs the full pipeline from `raw_query` → results in DB
  - Verifies `pipeline_runs` rows are created
  - Verifies company deduplication works
  - Verifies `searches.status` transitions correctly

### Test utilities

- [ ] `src/tests/fixtures/company.ts` — fake company data
- [ ] `src/tests/fixtures/search.ts` — fake search + criteria
- [ ] `src/tests/mocks/providers.ts` — mock implementations of the 5 interfaces
- [ ] `src/tests/helpers/db.ts` — test DB helpers (reset between tests)

---

## Phase 15 — MVP Validation

Before calling the MVP done:

- [ ] **End-to-end test**: type a real French query → verify the pipeline runs, results appear in UI
  - Example: `"Je cherche des startups françaises qui ont besoin d'un dev React"`
  - Verify: criteria extracted correctly, companies found, qualified with score and reason, contact found
- [ ] **Deduplication**: run the same search twice → verify no duplicate companies in DB
- [ ] **Pipeline resilience**: disconnect one provider → verify pipeline continues with backup/partial results
- [ ] **Error tracing**: verify `pipeline_runs` table has entries for each step with correct status and duration
- [ ] **Env validation**: remove one required env var → verify the app refuses to start with a clear error
- [ ] **Commit format**: verify commitlint rejects a non-conventional commit message
- [ ] **Pino logs**: verify logs appear in terminal (pino-pretty in dev), structured JSON in prod mode

---

## Critical Rules — Do Not Forget

These are the most common mistakes. Check before each PR.

| Rule                                                        | Where it applies                            |
| ----------------------------------------------------------- | ------------------------------------------- |
| Never import an adapter directly in business logic          | Pipeline steps, use cases, API routes       |
| Always `Result<T>`, never `throw` in business logic         | Every function that can fail                |
| Always object parameters                                    | Every function with more than 1 parameter   |
| Pipeline steps have zero side effects (no DB, no API)       | `pipeline/steps/*.ts`                       |
| `pipeline/index.ts` is the ONLY place that knows step order | Never reorder steps elsewhere               |
| `src/env.ts` is the ONLY place to read env vars             | Never `process.env.XYZ` directly            |
| `pipeline_runs` must be updated at EVERY step               | In `pipeline/index.ts` orchestrator         |
| Company deduplication by `domain` before inserting          | In `pipeline/index.ts` after qualify/enrich |
| Never crash the full pipeline for one company failing       | Error level 3 in qualify step               |
| No E2E tests (cost real API credits)                        | Test phase                                  |
