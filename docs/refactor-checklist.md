# Refactor Checklist

> This checklist is for the refactor of the existing codebase — not for building from scratch.
> The project setup, DB, tooling, and most infrastructure already exists and works.
> Focus only on what changes.
>
> Reference: `docs/alignment.md` for context on why we're refactoring.
> Reference: `docs/architecture.md` for the new architecture.

---

## Status legend

- **KEEP** — works correctly, do not touch
- **REWRITE** — exists but wrong, replace entirely
- **UPDATE** — exists, needs targeted changes
- **ADD** — does not exist yet, create it

---

## What works and must NOT be touched

- Project setup (Next.js, pnpm, ESLint, Prettier, Husky, commitlint) → **KEEP**
- Docker + PostgreSQL + pgvector → **KEEP**
- Drizzle schema (users, organizations, searches, search_templates, scheduled_searches, tags, outreach, pipeline_runs, result_feedback, integrations, api_keys, subscriptions, usage_logs) → **KEEP**
- Drizzle schema (companies, search_companies, company_embeddings, company_tags, user_company_interactions) → **REWRITE** — see Phase 0
- `src/env.ts` + environment variable validation → **UPDATE** — see Phase 0
- `src/lib/logger.ts` (pino singleton) → **KEEP**
- `src/lib/providers/interfaces/scraper.ts` → **KEEP**
- `src/lib/providers/scraper/firecrawl.ts` → **KEEP**
- `src/lib/providers/search/brave.ts` → **KEEP** (role changes, adapter stays)
- `src/lib/ai/prompts/generate-draft.ts` → **KEEP**
- qualify step logic (scoring, threshold 0.5, scrapedContent) → **KEEP** (see UPDATE below)
- enrich step email extraction from scrapedContent → **KEEP** (see UPDATE below)
- `pipeline/index.ts` orchestration structure → **KEEP** (see UPDATE below)
- API routes (`/api/chat`, `/api/pipeline`, `/api/searches`) → **KEEP**
- Frontend pages and components → **KEEP**

---

## Phase 0 — Prerequisites (do before anything else)

- [ ] **REWRITE** `src/lib/db/schema.ts`
  - Remove: `companies`, `search_companies`, `company_embeddings`, `company_tags`, `user_company_interactions`
  - Add: `entities` table — `(id, type, dedup_key, data jsonb, enriched_at, created_at)` + `UNIQUE(type, dedup_key)`
  - Add: `search_results` table — `(id, search_id FK → searches, entity_id FK → entities, score, reason, status, created_at)`
  - Add: `entity_embeddings` — `entity_id FK → entities` (was `company_id FK → companies`)
  - Add: `entity_tags` — `entity_id FK → entities` (was `company_id FK → companies`)
  - Add: `user_entity_interactions` — `entity_id FK → entities` (was `company_id FK → companies`)
  - Update: `contacts.company_id` → `entity_id FK → entities`
  - Update: `data_sources.company_id` → `entity_id FK → entities`
  - Update: `result_feedback` — `search_result_id FK → search_results`
  - Run `pnpm drizzle-kit generate` + `pnpm drizzle-kit migrate` (wipe dev data — we're in dev)

- [ ] **UPDATE** `src/env.ts`
  - Replace `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`
  - Remove `HUNTER_API_KEY`
  - Add `FRANCE_TRAVAIL_CLIENT_ID: z.string().min(1)`
  - Add `FRANCE_TRAVAIL_CLIENT_SECRET: z.string().min(1)`

- [ ] **UPDATE** `.env.example`
  - Same changes as `src/env.ts` above

---

## Phase 1 — Types (foundation — do this first)

- [ ] **UPDATE** `src/types/index.ts`
  - Add `targetEntity: "company" | "job_offer"` to `SearchCriteria`
  - Add `signalSources: SignalSource[]` to `SearchCriteria`
  - Replace `signals: string[]` with `searchStrategies: string[]` in `SearchCriteria`
  - Add `qualificationCriteria: string[]` to `SearchCriteria` (if not already there)
  - Add `SignalSource` type: `"france_travail" | "wttj" | "pappers_search" | "brave"`
  - Add `JobPosting` type (see `docs/providers.md` for definition)
  - Add `QualifiedJobOffer` and `EnrichedJobOffer` types
  - Add `scrapedContent?: string` to `QualifiedCompany` (to pass from qualify → enrich)

---

## Phase 2 — Provider Interfaces

- [ ] **ADD** `src/lib/providers/interfaces/job-board.ts`
  - `JobBoardProvider` interface with `searchJobs(criteria: JobSearchCriteria)`
  - `JobSearchCriteria` type
  - See `docs/providers.md` for the exact definition

- [ ] **UPDATE** `src/lib/providers/interfaces/company.ts`
  - Add `findByName(name: string): Promise<Result<CompanyData | null>>`
  - This is critical — used to resolve company name → domain after job board discovery

- [ ] **UPDATE** `src/lib/providers/interfaces/llm.ts`
  - Add `extractCompanyNames(results: SearchResult[]): Promise<Result<string[]>>`
  - Update `QualifyInput`: `entity` must accept both `CompanyData` and `JobPosting`
  - `scrapedContent` must be mandatory (not optional) in `QualifyInput`

---

## Phase 3 — Provider Adapters

- [ ] **ADD** `src/lib/providers/job-board/france-travail.ts`
  - Implements `JobBoardProvider`
  - Calls France Travail API (verify auth in Phase 0 of original checklist)
  - Returns `JobPosting[]` with company names

- [ ] **ADD** `src/lib/providers/job-board/wttj.ts`
  - Implements `JobBoardProvider`
  - Scrapes WTTJ search result pages via Firecrawl
  - Parses HTML to extract job listings + company names
  - Costs Firecrawl credits — log every scrape

- [ ] **UPDATE** `src/lib/providers/company/pappers.ts`
  - Add `findByName(name: string)` implementation
  - This method is now called in discover to resolve company name → official domain

- [ ] **UPDATE** `src/lib/providers/llm/vercel.ts`
  - Add `extractCompanyNames()` method — uses `buildExtractCompanyNamesPrompt`
  - Update `qualify()` — pass both `entity` and `scrapedContent` correctly (bug fix: scrapedContent was being ignored)
  - Update `extractCriteria()` — output must include `targetEntity`, `signalSources`, `searchStrategies`, `qualificationCriteria`

---

## Phase 4 — AI Prompts

- [ ] **REWRITE** `src/lib/ai/prompts/extract-criteria.ts`
  - Output schema must include: `targetEntity`, `signalSources`, `searchStrategies`, `qualificationCriteria`
  - Remove `signals` array (replaced by dynamic `qualificationCriteria`)
  - `searchStrategies` must target company pages, NOT job boards (see `docs/alignment.md`)
  - `signalSources` must be inferred from the query intent

- [ ] **ADD** `src/lib/ai/prompts/extract-company-names.ts`
  - Input: array of `{ title, url, snippet }` from Brave results
  - Output: array of real company names
  - Must ignore: aggregators, job boards, directories, news sites
  - Used by discover when Brave queries are activated

- [ ] **UPDATE** `src/lib/ai/prompts/qualify.ts`
  - Use `qualificationCriteria` array instead of `signals`
  - Accept both `CompanyData` and `JobPosting` as entity input
  - For job offers: the "content" to score is the job description, not a scraped website

---

## Phase 5 — Use Case Configs

- [ ] **UPDATE** `src/lib/use-cases/index.ts`
  - Update `UseCaseConfig` type: add `targetEntity`, remove `signals`/`scoringWeights`
  - Keep: `providers`, `enrichStrategy`, `maxResults`
  - Add `jobBoard` provider to the `providers` object

- [ ] **UPDATE** `src/lib/use-cases/freelance.ts` (or rename to `freelance-client.ts`)
  - Remove `signals` and `scoringWeights`
  - Add `targetEntity: "company"`
  - Add `jobBoard` providers: France Travail + WTTJ
  - Keep: `enrichStrategy: "domain"`, `maxResults: 20`

- [ ] **ADD** `src/lib/use-cases/find-jobs.ts`
  - `targetEntity: "job_offer"`
  - `jobBoard` providers: France Travail + WTTJ
  - `enrichStrategy: "domain"`
  - `maxResults: 30`
  - No scraper in qualify (posting content is scored directly)

---

## Phase 6 — Pipeline Steps

- [ ] **REWRITE** `src/lib/pipeline/steps/discover.ts`

  This is the most critical change. Full rewrite.

  New signature:

  ```typescript
  discover({
    criteria,
    jobBoard,   // NEW — France Travail + WTTJ
    search,     // Brave — secondary only
    company,    // Pappers + SIRENE
    llm,        // for extractCompanyNames when Brave is used
  }: DiscoverOptions): Promise<Result<CompanyData[] | JobPosting[]>>
  ```

  New logic for `targetEntity = "company"`:
  1. Activate sources from `criteria.signalSources` in parallel
  2. France Travail / WTTJ → job postings → extract `companyName` from each posting
  3. Pappers `search()` → `CompanyData[]` directly (for sector/location/size criteria)
  4. Brave `searchStrategies` → `llm.extractCompanyNames()` → company names
  5. All company names → `company.findByName()` → domain + official data
  6. Deduplicate by domain → `CompanyData[]`

  New logic for `targetEntity = "job_offer"`:
  1. France Travail `searchJobs()` → `JobPosting[]`
  2. WTTJ `searchJobs()` → `JobPosting[]`
  3. Merge → deduplicate by `url` → `JobPosting[]`

  **Never** use URL domain from Brave results directly as company domain.

- [ ] **UPDATE** `src/lib/pipeline/steps/qualify.ts`
  - Accept `CompanyData[] | JobPosting[]` as input
  - For companies: scrape priority pages (`/jobs`, `/recrutement`, `/careers`, homepage), store `scrapedContent` in result
  - For job offers: pass the posting `description` as `scrapedContent` to the LLM — no Firecrawl call
  - Score threshold: 0.5 (keep existing)
  - Fix: `scrapedContent` must be passed to enrich (was being lost before)

- [ ] **UPDATE** `src/lib/pipeline/steps/enrich.ts`
  - Accept `QualifiedCompany[] | QualifiedJobOffer[]` as input
  - For companies: use `scrapedContent` from qualify to extract emails → fallback scrape `/contact`, `/equipe`, `/team`
  - For job offers: call `company.findByName(posting.companyName)` to add official company data

---

## Phase 7 — Pipeline Orchestrator

- [ ] **UPDATE** `src/lib/pipeline/index.ts`
  - Pass `jobBoard` provider to `discover()`
  - Handle both `CompanyData[]` and `JobPosting[]` return types from discover
  - DB writes: all results go to `search_results` with `entity_type` set correctly
    - `"company"` → set `entity_id = company.id` (FK → companies), `entity_data = {}`
    - `"job_offer"` → set `entity_id = null`, `entity_data = { ...jobPosting }` as JSON

---

## Phase 8 — Tests

- [ ] **ADD** `src/lib/providers/job-board/__tests__/france-travail.test.ts`
- [ ] **ADD** `src/lib/providers/job-board/__tests__/wttj.test.ts`
- [ ] **UPDATE** `src/lib/pipeline/steps/__tests__/discover.test.ts` — test new multi-source logic
- [ ] **UPDATE** `src/lib/pipeline/steps/__tests__/qualify.test.ts` — test both entity types
- [ ] **UPDATE** `src/lib/pipeline/steps/__tests__/enrich.test.ts` — test both entity types
- [ ] **UPDATE** `src/tests/mocks/providers.ts` — add `JobBoardProvider` mock

---

## Phase 9 — Validation

Run these checks before calling the refactor done:

- [ ] Use Case 1: `"Je cherche des startups françaises qui ont besoin d'un dev React"`
  - discover must activate France Travail + WTTJ
  - Results must be real company domains (NOT linkedin.com, indeed.fr, welcometothejungle.com)
  - At least 5 results with score ≥ 0.5 and a contact email each

- [ ] Use Case 2: `"Je cherche une mission freelance TypeScript Node.js en full remote"`
  - discover must return `JobPosting[]` from France Travail + WTTJ
  - qualify must score each posting without calling Firecrawl
  - Results must have company data from Pappers

- [ ] `pipeline_runs` has correct entries for every step (status, duration_ms)
- [ ] Firecrawl credit usage: verify no double-scraping (qualify + enrich must not scrape the same URL twice)
- [ ] One provider failure must not crash the pipeline (test by disabling France Travail temporarily)

---

## What NOT to do

- Do not touch the DB schema beyond what Phase 0 specifies (`entities` + `search_results` migration only)
- Do not touch the project setup, tooling, or Docker config
- Do not reintroduce Hunter.io
- Do not add a NOISE_DOMAINS blocklist
- Do not use Brave as primary discovery source
