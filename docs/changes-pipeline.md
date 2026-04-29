# Pipeline Improvements

## Model

- [ ] `freelance.ts` — switch `gpt-4o-mini` → `gpt-5-mini`

## Step 1 — extract-criteria

- [ ] Map `uiCriteria` keys to actual `SearchCriteria` fields before passing to LLM

## Step 2 — discover

- [ ] Add `generateSearchQueries` — dedicated LLM call that produces 3-5 targeted Brave Search queries from criteria + rawQuery + useCase
- [ ] Run all queries in parallel (Promise.allSettled), merge + deduplicate by domain
- [ ] Raise Brave Search limit: 3 → 15 per query
- [ ] Filter noise domains (insee.fr, data.gouv.fr, annuaire-entreprises.data.gouv.fr, linkedin.com, …)
- [ ] Filter SIREN-as-domain (pure digit strings) — not valid web domains
- [ ] Remove CompanyProvider dependency from discover — build CompanyData directly from search results

## Step 3 — qualify

- [ ] Scrape 2-3 pages per company (homepage + /equipe + /jobs) instead of homepage only
- [ ] Parallelize with Promise.allSettled instead of sequential loop

## Step 4 — enrich (between qualify and enrich)

- [ ] Add score threshold (0.35) — only enrich companies above it
- [ ] Switch contacts to Apollo.io instead of FirecrawlEmailProvider
- [ ] Move SIRENE/Pappers here as optional legal enrichment by company name
- [ ] Parallelize with Promise.allSettled
