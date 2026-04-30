# Discover Refonte — LLM-based Company Extraction

## Context

Run `d50ca920` returned 0 results. Root cause: `discover` used the job board domain
(`jobs.smartrecruiters.com`) as the company domain instead of extracting the real company
behind the job posting.

## Root Cause

```
search result: jobs.smartrecruiters.com/Devoteam/fullstack-dev
current behaviour: domain = "jobs.smartrecruiters.com" → qualify jobs.smartrecruiters.com ❌
wanted: extract "Devoteam" → resolve devoteam.fr → qualify devoteam.fr ✓
```

## New Architecture

Instead of classifying sites upfront (NOISE_DOMAINS, JOB_BOARD_EXTRACTORS...), treat every
search result as a potential source of company names and let the LLM decide.

```
search results (title + url + snippet)
     ↓
LLM batch: extract real company names — ignore aggregators, platforms, directories
     ↓
for each company name → Brave search to find real domain
     ↓
Pappers/SIRENE for official metadata (name, sector, location...)
     ↓
qualify → enrich (unchanged)
```

### Why this generalises to future use cases

- UC2 (agency): search returns company pages → LLM extracts company names → same flow
- UC3 (LinkedIn Sales): discover still finds companies → enrich with `enrichStrategy: "persona"` handles contacts
- Any future use case: LLM adapts to query intent, no hardcoded site list to maintain

---

## Changes — Implementation Order

### 1. `src/lib/ai/prompts/discover-extract.ts` (NEW)

New prompt for LLM company extraction.

- Input: array of `{ title: string; url: string; snippet?: string }`
- Output: array of company names (strings)
- Rules for the LLM:
  - Extract names of real prospect companies only
  - Ignore aggregated job boards, freelance platforms, directories, news sites
  - If a result is an individual job posting → extract the hiring company name
  - If a result is a company page → extract the company name
  - If nothing extractable → return nothing for that result

### 2. `LLMProvider` interface — new method

File: `src/lib/providers/interfaces/llm.ts`

```typescript
extractCompanies(results: Array<{ title: string; url: string; snippet?: string }>): Promise<Result<string[]>>
```

### 3. `vercel.ts` — implement `extractCompanies`

File: `src/lib/providers/llm/vercel.ts`

Use `generateObject` with a Zod schema: `{ companies: z.array(z.string()) }`.
Call `buildDiscoverExtractPrompt({ results })`.

### 4. `discover.ts` — full rewrite

File: `src/lib/pipeline/steps/discover.ts`

**Remove:**

- `NOISE_DOMAINS` set
- `deduplicateByDomain` (replaced by LLM extraction)
- `resolveCompany` using URL domain directly

**Add:**

- `llm: LLMProvider` to `DiscoverOptions`
- `extractCompanyNames`: calls LLM with all search results → returns company names
- `resolveCompanyDomain`: for each name → Brave search → extract domain from first result
- Fallback: if scrape of aggregated page needed → scraper optional in DiscoverOptions

**New flow:**

```typescript
1. runSearchStrategies (unchanged)
2. extractCompanyNames({ results, llm }) → string[]
3. for each name → resolveCompanyDomain({ name, search }) → string | null
4. deduplicate resolved domains
5. for each domain → resolveCompany({ domain, company }) → CompanyData (unchanged)
6. slice to maxResults
```

**DiscoverOptions:**

```typescript
type DiscoverOptions = {
  criteria: SearchCriteria;
  search: SearchProvider;
  company: CompanyProvider;
  llm: LLMProvider;
};
```

### 5. `pipeline/index.ts` — pass llm to discover

File: `src/lib/pipeline/index.ts`

```typescript
// before
await discover({ criteria, search, company });

// after
await discover({ criteria, search, company, llm });
```

### 6. `extract-criteria` prompt — optimisation (secondary)

File: `src/lib/ai/prompts/extract-criteria.ts`

Guide the LLM to generate queries that return company pages more directly
(careers pages, tech blogs, funding news) rather than aggregated job board listings.
This reduces the need to scrape aggregated pages — fewer Firecrawl credits used.

Not a correctness fix — the new discover handles any query type. This is efficiency only.

---

## What does NOT change

- `qualify`, `enrich` — untouched
- `Result<T>` pattern throughout
- Use case config structure (`enrichStrategy`, `maxResults`)
- DB schema

---

## Docs to update after implementation

- `docs/architecture.md` — discover step now uses LLM
- `docs/providers.md` — new `extractCompanies` method on LLMProvider
- `docs/use-cases.md` — note that discover generalises across all use cases
