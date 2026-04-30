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

- [ ] **json-render** (`json-render.dev`) — does it exist? API still valid? How to install?
- [ ] **AI Elements** (`elements.ai-sdk.dev`) — does it exist? Is it compatible with current Vercel AI SDK version?
- [ ] **Streamdown** (`streamdown.ai`) — does it exist? Still maintained?
- [ ] **France Travail API** (ex-Pôle Emploi) — free official French job API, verify authentication method and endpoints
- [ ] **WTTJ** (Welcome to the Jungle) — no official API, verify their pages are still scrapeable via Firecrawl
- [ ] **Firecrawl** — 500 credits one-time (not monthly), verify current pricing and credits available
- [ ] **Pappers** — free tier still available? `findByName()` endpoint exists?
- [ ] **@t3-oss/env-nextjs** — still the recommended approach for Next.js env validation?
- [ ] **Vercel AI SDK** — current major version? Any breaking changes?
- [ ] **Drizzle ORM + pgvector** — current approach for vector columns?

> If any tool has changed significantly: update `docs/tech-stack.md` before continuing.
> If a tool no longer exists: discuss before picking a replacement.

---

## Phase 1 — Project Bootstrap

- [ ] Initialize project: `pnpm create next-app mizaha --typescript --app --tailwind --eslint --src-dir`
- [ ] Verify `tsconfig.json` has `"strict": true`
- [ ] Configure **Prettier** — create `.prettierrc`
- [ ] Configure **ESLint** — adjust `.eslintrc.json` (strict TypeScript rules, no `any`)
- [ ] Install and configure **Husky**: `pnpm add -D husky lint-staged && pnpm husky init`
- [ ] Configure **lint-staged** in `package.json` — run ESLint + Prettier on staged files only
- [ ] Install and configure **commitlint**: `pnpm add -D @commitlint/cli @commitlint/config-conventional`
- [ ] Create `.commitlintrc.json` with `{ "extends": ["@commitlint/config-conventional"] }`
- [ ] Add commitlint to Husky commit-msg hook
- [ ] Install **pino + pino-pretty**: `pnpm add pino && pnpm add -D pino-pretty`
- [ ] Create `src/lib/logger.ts` — singleton pino logger (JSON in prod, pino-pretty in dev)
- [ ] First commit: `chore(setup): initialize next.js project with tooling`

---

## Phase 2 — Environment Variables

- [ ] Copy `.env.example` from `docs/project-structure.md` → create actual `.env.example`
- [ ] Create `.env.local` (never commit this file — add to `.gitignore`)
- [ ] Install `@t3-oss/env-nextjs` and `zod`: `pnpm add @t3-oss/env-nextjs zod`
- [ ] Create `src/env.ts` — declare and validate all env vars (see example in `docs/tech-stack.md`)
- [ ] Import `env` from `src/env.ts` everywhere env vars are needed — **never use `process.env` directly**

---

## Phase 3 — Docker + Database

- [ ] Create `docker-compose.yml`:

  ```yaml
  services:
    db:
      image: pgvector/pgvector:pg16
      environment:
        POSTGRES_DB: mizaha
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: password
      ports:
        - "5432:5432"
      volumes:
        - pgdata:/var/lib/postgresql/data
  volumes:
    pgdata:
  ```

- [ ] Start the container: `docker compose up -d`
- [ ] Install Drizzle: `pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit`
- [ ] Create `drizzle.config.ts`
- [ ] Create `src/lib/db/index.ts` — PostgreSQL connection client
- [ ] Create `src/lib/db/schema.ts` — translate ALL 21 tables from `docs/database.md`
  - **Critical**: enable pgvector extension in a migration: `CREATE EXTENSION IF NOT EXISTS vector;`
  - Use Drizzle's vector column type for `company_embeddings.embedding`
  - Tables marked "Schema created, not used" in MVP: still create the schema, just don't use them
- [ ] Run first migration: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
- [ ] Verify schema in DB (connect and check tables exist)

---

## Phase 4 — Shared Types

- [ ] Create `src/types/index.ts` — define all shared types used across the project:
  - `Result<T>` type (see `docs/conventions.md` §1)
  - `SearchCriteria` (includes `targetEntity`, `signalSources`, `searchStrategies`, `qualificationCriteria`)
  - `SignalSource` type: `"france_travail" | "wttj" | "pappers_search" | "brave"`
  - `CompanyData`, `QualifiedCompany`, `EnrichedCompany`
  - `JobPosting`, `QualifiedJobOffer`, `EnrichedJobOffer`
  - `Contact`, `QualificationResult`, `SearchResult`, `ScrapedContent`
  - (All types defined in `docs/providers.md` — use it as the source)

---

## Phase 5 — Provider Interfaces

Create the 6 interface files. **These are contracts — do not add implementation details here.**

- [ ] `src/lib/providers/interfaces/search.ts` — `SearchProvider`, `SearchInput`, `SearchResult`
- [ ] `src/lib/providers/interfaces/company.ts` — `CompanyProvider`, `CompanyCriteria`, `CompanyData`
- [ ] `src/lib/providers/interfaces/scraper.ts` — `ScraperProvider`, `ScrapedContent`
- [ ] `src/lib/providers/interfaces/email.ts` — `EmailProvider`, `FindContactInput`, `Contact`
- [ ] `src/lib/providers/interfaces/job-board.ts` — `JobBoardProvider`, `JobSearchCriteria`, `JobPosting`
- [ ] `src/lib/providers/interfaces/llm.ts` — `LLMProvider`, `SearchCriteria`, `QualificationResult`

Reference: `docs/providers.md` — all interface definitions are there verbatim.

---

## Phase 6 — Provider Adapters (MVP only)

For each adapter:

- Implement the interface (no extra public methods)
- Use `Result<T>` for all methods that can fail
- Log each API call with pino (provider name, duration, status)
- Never import another adapter — only the interface

### Job Board (primary discovery — implement first)

- [ ] `src/lib/providers/job-board/france-travail.ts` — implements `JobBoardProvider`
  - Use the France Travail API (free, official — verify auth method in Phase 0)
  - `searchJobs()` → returns `JobPosting[]` with company names

- [ ] `src/lib/providers/job-board/wttj.ts` — implements `JobBoardProvider`
  - Scrape WTTJ search result pages via Firecrawl (costs Firecrawl credits)
  - Parse HTML to extract job listings + company names

### Company (French official data)

- [ ] `src/lib/providers/company/pappers.ts` — implements `CompanyProvider`
  - Implement `findByName()` — critical for resolving company name → domain
  - Implement `findByDomain()` and `search()`

- [ ] `src/lib/providers/company/sirene.ts` — implements `CompanyProvider`
  - SIRENE is the official free French registry (INSEE) — unlimited

### Search (secondary — for news/funding signals)

- [ ] `src/lib/providers/search/brave.ts` — implements `SearchProvider`
  - Used only for targeted queries, not primary discovery

### Scraper

- [ ] `src/lib/providers/scraper/firecrawl.ts` — implements `ScraperProvider`
  - 500 credits one-time — log EVERY use, credits are precious

### Email (contacts)

- [ ] `src/lib/providers/email/firecrawl.ts` — implements `EmailProvider`
  - Strategy: reuse `scrapedContent` if already available → extract emails via regex
  - Fallback: scrape `/contact`, `/equipe`, `/team`, `/about` pages
  - Do NOT use Hunter (requires paid plan)

### LLM

- [ ] `src/lib/providers/llm/vercel.ts` — implements `LLMProvider`
  - Use Vercel AI SDK (`generateObject` with Zod schemas)
  - Model injected at runtime — not hardcoded in the adapter
  - Methods: `extractCriteria`, `extractCompanyNames`, `qualify`, `generateDraft`

---

## Phase 7 — AI Prompts

Prompts are never written inline in code. They live here and are imported.

- [ ] `src/lib/ai/prompts/extract-criteria.ts`
  - Input: `rawQuery` + `useCase` + optional `uiCriteria`
  - Output: full `SearchCriteria` including `targetEntity`, `signalSources`, `searchStrategies`, `qualificationCriteria`
  - Must handle French queries (see examples in `docs/use-cases.md`)
  - `searchStrategies` must target company pages, NOT job boards (see `docs/architecture.md`)

- [ ] `src/lib/ai/prompts/extract-company-names.ts`
  - Input: array of `{ title, url, snippet }` from Brave search results
  - Output: array of real company names (ignores aggregators, job boards, directories)
  - Used by discover step when Brave queries return indirect results

- [ ] `src/lib/ai/prompts/qualify.ts`
  - Input: entity (company OR job offer) + `scrapedContent` + `qualificationCriteria`
  - Output: `{ score: 0.0-1.0, reason: string (in French), matchedCriteria: string[] }`
  - Threshold: score < 0.5 means filtered out

- [ ] `src/lib/ai/prompts/generate-draft.ts`
  - Input: contact + company context
  - Output: personalized outreach message draft (in French)

---

## Phase 8 — Use Case Configuration

- [ ] `src/lib/use-cases/index.ts` — define `UseCaseConfig` type and `getUseCase()` registry:

  ```typescript
  type UseCaseConfig = {
    name: string;
    targetEntity: "company" | "job_offer";
    providers: { search; company; jobBoard; scraper; email; llm };
    enrichStrategy: "domain" | "persona";
    maxResults: number;
  };
  ```

- [ ] `src/lib/use-cases/freelance-client.ts` — Use Case 1 (MVP):
  - `targetEntity: "company"`
  - `providers.jobBoard`: France Travail + WTTJ
  - `providers.company`: Pappers + SIRENE
  - `enrichStrategy: "domain"`
  - `maxResults: 20`

- [ ] `src/lib/use-cases/find-jobs.ts` — Use Case 2:
  - `targetEntity: "job_offer"`
  - `providers.jobBoard`: France Travail + WTTJ
  - No scraper in qualify (score the posting directly)
  - `enrichStrategy: "domain"` (add company info in enrich)
  - `maxResults: 30`

---

## Phase 9 — Pipeline Steps

Each step = one pure function. No DB writes. No provider calls except through the interface.
Input and output types come from `src/types/index.ts`.

- [ ] `src/lib/pipeline/steps/extract-criteria.ts`
  - Signature: `extractCriteria({ rawQuery, useCase, uiCriteria, llm }: Options): Promise<Result<SearchCriteria>>`
  - Output includes: `targetEntity`, `signalSources`, `searchStrategies`, `qualificationCriteria`

- [ ] `src/lib/pipeline/steps/discover.ts`
  - Signature: `discover({ criteria, jobBoard, search, company, llm }: Options): Promise<Result<CompanyData[] | JobPosting[]>>`
  - Multi-source, signal-aware (see `docs/architecture.md` — Discover Step section)
  - For `targetEntity = "company"`:
    - Activate sources listed in `criteria.signalSources` in parallel
    - France Travail / WTTJ → job postings → extract company names → `company.findByName()` → domain
    - Pappers `search()` → companies directly (for sector/location/size criteria)
    - Brave → LLM `extractCompanyNames()` → `company.findByName()` (for news/funding signals)
    - Converge → deduplicate by domain → `CompanyData[]`
  - For `targetEntity = "job_offer"`:
    - France Travail + WTTJ → `JobPosting[]` directly
  - **Never use Brave as primary source for company discovery**

- [ ] `src/lib/pipeline/steps/qualify.ts`
  - Signature: `qualify({ entities, criteria, scraper, llm }: Options): Promise<Result<QualifiedEntity[]>>`
  - For companies: scrape priority pages first (`/jobs`, `/recrutement`, `/careers`, then homepage)
    - Store `scrapedContent` in result — passed to enrich to avoid double scraping
  - For job offers: Claude scores the posting description directly — NO scraping
  - Threshold: score < 0.5 → filtered out
  - **Error level 3**: one entity fails → skip it, continue with others

- [ ] `src/lib/pipeline/steps/enrich.ts`
  - Signature: `enrich({ entities, email, company }: Options): Promise<Result<EnrichedEntity[]>>`
  - For companies: reuse `scrapedContent` from qualify to extract emails (zero extra Firecrawl credits)
    - Fallback: Firecrawl scrape `/contact`, `/equipe`, `/team`
  - For job offers: add company data from `company.findByName()` or `company.findByDomain()`

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

- [ ] `src/lib/providers/job-board/__tests__/france-travail.test.ts` — mock France Travail API response
- [ ] `src/lib/providers/job-board/__tests__/wttj.test.ts` — mock Firecrawl scrape of WTTJ page
- [ ] `src/lib/providers/company/__tests__/pappers.test.ts` — test `findByName()` specifically
- [ ] `src/lib/providers/search/__tests__/brave.test.ts`
- [ ] `src/lib/providers/scraper/__tests__/firecrawl.test.ts`
- [ ] `src/lib/providers/email/__tests__/firecrawl.test.ts` — test email extraction from scraped content

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
- [ ] `src/tests/mocks/providers.ts` — mock implementations of all 6 interfaces (including JobBoardProvider)
- [ ] `src/tests/helpers/db.ts` — test DB helpers (reset between tests)

---

## Phase 15 — MVP Validation

Before calling the MVP done:

- [ ] **End-to-end test — Use Case 1** (find companies): type a real French query → pipeline runs, companies appear
  - Example: `"Je cherche des startups françaises qui ont besoin d'un dev React"`
  - Verify: France Travail + WTTJ activated, companies found (NOT job board domains), qualified with score ≥ 0.5, contact email found
- [ ] **End-to-end test — Use Case 2** (find jobs): type a job search query → job offers appear
  - Example: `"Je cherche une mission freelance TypeScript Node.js en remote"`
  - Verify: job postings returned, scored, company info enriched from Pappers
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
| **Never use Brave as primary company discovery source**     | `discover.ts` — use France Travail + WTTJ   |
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
| Turborepo: NOT used (single app, not monorepo)              | Never add it                                |
