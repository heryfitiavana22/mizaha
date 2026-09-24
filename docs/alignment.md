# Alignment — Before You Write a Single Line of Code

> Read this file first. Then read ALL files in `docs/`. Then answer the questions at the bottom.
> Do not start coding until alignment is confirmed.

---

## Context — What happened

A first version of the pipeline was built and tested. It failed at the **discover step**.

**Root cause**: The pipeline used Brave Search as the primary company discovery source.
For a query like "entreprise qui cherche un dev TypeScript", Brave returns:

- LinkedIn job listings
- Indeed, Welcome to the Jungle, Glassdoor
- Reddit discussions
- Aggregators and directories

Real company websites (galadrim.fr, pennylane.com...) appear at position 6-10, behind all the platforms.
Result after 9 real test runs: **0 qualified companies**. The pipeline was returning job board domains, not company domains.

Attempts to fix it with a NOISE_DOMAINS blocklist failed — new platforms appeared at every run (whack-a-mole).

**This is a complete refactor. The new architecture solves this at the root.**

---

## What changed — The new architecture

### 1. Brave is no longer the primary discovery source

Brave is now **secondary** — used only for "news/funding" signals where no specialized API exists.
It must never be used to discover companies directly from a generic query.

### 2. Discovery is now signal-aware and multi-source

The LLM (in `extract-criteria`) produces a `SearchCriteria` object that includes:

- `targetEntity`: what we're looking for (`"company"` or `"job_offer"`)
- `signalSources`: which specialized sources to activate (`france_travail`, `wttj`, `pappers_search`, `brave`)
- `searchStrategies`: Brave queries (only for news/funding signals — NOT for discovery)
- `qualificationCriteria`: what LLM verifies per entity

The `discover` step activates sources in parallel based on `signalSources`:

| Signal                      | Source                 | Why it works                                                      |
| --------------------------- | ---------------------- | ----------------------------------------------------------------- |
| "cherche un dev"            | France Travail API     | Official French job API — returns postings with company names     |
| "tech startup jobs"         | WTTJ Algolia API       | Public Algolia index — company names + slugs, no scraping, no LLM |
| "mission freelance"         | FreeWork API           | Public JSON API — freelance contractor missions, no auth          |
| "secteur + taille + région" | SIRENE                 | Structured query → company data directly                          |
| "levée de fonds / news"     | Brave targeted queries | No specialized API for this                                       |

For `targetEntity = "company"`: all sources return company names → `Pappers.findByName()` resolves the domain → deduplicated `CompanyData[]`.

For `targetEntity = "job_offer"`: FreeWork + France Travail return `JobPosting[]` directly — no domain resolution needed.

### 3. The pipeline now supports two entity types

`targetEntity` changes the behavior of every step:

| Step     | `"company"`                        | `"job_offer"`                             |
| -------- | ---------------------------------- | ----------------------------------------- |
| discover | returns CompanyData[]              | returns JobPosting[]                      |
| qualify  | Firecrawl scrapes site, LLM scores | LLM scores posting directly (no scraping) |
| enrich   | extract email from scraped content | add company data from Pappers             |

### 4. Email finding — no Hunter

Hunter.io requires a paid plan. The email strategy is:

1. Reuse `scrapedContent` from qualify (already scraped — zero extra Firecrawl credits)
2. Extract emails via regex from the scraped content
3. Fallback: Firecrawl scrape `/contact`, `/equipe`, `/team` pages

### 5. LLM adapter — Vercel AI SDK

Single adapter `llm/vercel.ts` wraps Vercel AI SDK. The model is injected at runtime via the use case config — the adapter never hardcodes a model name.

---

## What we expect from you

### Use Case 1 — Freelance dev looking for client companies (`targetEntity: "company"`)

Input: `"Je cherche des startups françaises qui ont besoin d'un dev React"`

Expected output:

- Real French companies (galadrim.fr, pennylane.com, etc. — NOT linkedin.com, indeed.fr)
- Each company has: name, domain, relevance score ≥ 0.5, reason in French, at least one contact email
- `pipeline_runs` has entries for each step with status + duration

### Use Case 2 — Dev looking for job offers (`targetEntity: "job_offer"`)

Input: `"Je cherche une mission freelance TypeScript Node.js en full remote"`

Expected output:

- Real job postings from FreeWork (freelance) or France Travail (CDI/CDD)
- Each posting has: title, company name, location, contract type, why it matches, company info from SIRENE

### The pipeline must never

- Return job board domains (linkedin.com, indeed.fr, welcometothejungle.com) as results
- Crash entirely because one company/offer failed
- Use Hunter.io (paid plan required)
- Use Brave Search for primary company discovery

---

## Hard constraints

| Constraint                                                  | Why                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Read `docs/` entirely before writing code                   | The previous Claude didn't fully align — the discover step was built wrong |
| `doc-by-other-cc/` is NOT the reference                     | It contains the failed approach. Use `docs/` only                          |
| France Travail + WTTJ are primary for company discovery     | This is the architectural fix — do not revert to Brave-first               |
| FreeWork is primary for job_offer (freelance) discovery     | Public JSON API — free, no auth, rich data                                 |
| Every function returns `Result<T>`, never throws            | Convention 1 — non-negotiable                                              |
| Object parameters everywhere                                | Convention 2 — non-negotiable                                              |
| Pipeline steps are pure (no DB writes, no direct API calls) | Convention 4 — non-negotiable                                              |
| Firecrawl credits are limited (500 one-time)                | Budget every scrape — never scrape twice for the same content              |
| `scrapedContent` flows from qualify → enrich                | Avoids double scraping — never re-scrape what qualify already fetched      |

---

## Alignment questions — Answer these before coding

Read `docs/` completely, then answer:

**1. Architecture**

- What does `signalSources` contain and who generates it?
- For a query "entreprise SaaS Paris qui recrute un dev", which sources would be activated and why?
- For a query "mission freelance React remote", what is `targetEntity` and what does discover return?

**2. Discover step**

- When does discover call `Pappers.findByName()`? When does it call `Pappers.search()`?
- In what case does discover use Brave at all?
- How does deduplication work for companies?

**3. Qualify step**

- What is the score threshold? What happens to entities below it?
- Why does qualify scrape `/jobs` before the homepage for company searches?
- For `targetEntity = "job_offer"`, what does qualify receive as `scrapedContent`?

**4. Enrich step**

- How does enrich find emails without calling Hunter?
- What is `scrapedContent` in the enrich step and where does it come from?
- For `targetEntity = "job_offer"`, what does enrich add to each result?

**5. Use case config**

- What fields does `UseCaseConfig` have?
- What is the difference between `enrichStrategy: "domain"` and `enrichStrategy: "persona"`?
- What does adding a new use case require? What does it NOT require?

**6. Conventions**

- What does `Result<T>` look like? Write it from memory.
- Name 3 conventions from `docs/conventions.md` that apply to every file you write.

---

> Once you've answered these questions, we'll validate alignment together before you write any code.
