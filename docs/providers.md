# External Providers

## Principle

Code against **TypeScript interfaces**, never against SDKs directly.
Changing a provider = modifying one file in `src/lib/providers/[category]/`.
The rest of the code doesn't know which provider is being used.

---

## The 6 Interfaces

### `SearchProvider`

Web search — used for "news/funding" signals and targeted company-name queries.
Not used for primary company discovery.

```typescript
interface SearchProvider {
  readonly name: string;
  search(input: SearchInput): Promise<Result<SearchResult[]>>;
}

type SearchInput = { query: string; options?: SearchOptions };
type SearchOptions = { country?: string; limit?: number };

// SearchResult — in src/types/index.ts
type SearchResult = { url: string; title: string; snippet: string };
```

---

### `CompanyProvider`

Official company data (French registries).

```typescript
interface CompanyProvider {
  readonly name: string;
  findByDomain(domain: string): Promise<Result<CompanyData | null>>;
  findByName(name: string): Promise<Result<CompanyData | null>>;
  search(criteria: CompanyCriteria): Promise<Result<CompanyData[]>>;
}

type CompanyCriteria = {
  sector?: string;
  location?: string;
  minEmployees?: number;
  maxEmployees?: number;
};

// CompanyData — in src/types/index.ts
type CompanyData = {
  name: string;
  domain: string;
  sector: string;
  location: string;
  employeeCount?: number;
  legalForm?: string;
  foundedAt?: string;
};
```

---

### `JobBoardProvider`

Job postings from job boards. Primary discovery source for "hiring" signals.

```typescript
interface JobBoardProvider {
  readonly name: string;
  searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>>;
}

type JobSearchCriteria = {
  keywords?: string[];
  location?: string;
  contractType?: "cdi" | "cdd" | "freelance" | "alternance";
  techStack?: string[];
  remote?: boolean;
  limit?: number;
};

// JobPosting — in src/types/index.ts
type JobPosting = {
  title: string;
  companyName: string;
  companyDomain?: string; // not always available — lookup via CompanyProvider if missing
  location: string;
  contractType: string;
  techStack?: string[];
  description: string;
  url: string;
  postedAt?: string;
};
```

---

### `ScraperProvider`

Content extraction from a website.

```typescript
interface ScraperProvider {
  readonly name: string;
  scrape(url: string): Promise<Result<ScrapedContent>>;
}

// ScrapedContent — in src/types/index.ts
type ScrapedContent = {
  url: string;
  title: string;
  content: string;
  metadata: Record<string, string>;
};
```

---

### `EmailProvider`

Contact extraction from a company domain.
Primary strategy: scrape the company's own team/contact pages via Firecrawl.

```typescript
interface EmailProvider {
  readonly name: string;
  findByDomain(domain: string): Promise<Result<Contact[]>>;
  findContact(input: FindContactInput): Promise<Result<Contact | null>>;
}

type FindContactInput = { name: string; domain: string };

// Contact — in src/types/index.ts
type Contact = {
  name?: string;
  title?: string;
  email: string;
  confidence: number; // 0-100
  linkedinUrl?: string;
};
```

---

### `LLMProvider`

Language model calls. Model injected at runtime via use case config — not hardcoded.

```typescript
interface LLMProvider {
  readonly name: string;
  extractCriteria(input: ExtractCriteriaInput): Promise<Result<SearchCriteria>>;
  extractCompanyNames(results: SearchResult[]): Promise<Result<string[]>>;
  qualify(input: QualifyInput): Promise<Result<QualificationResult>>;
  generateDraft(input: GenerateDraftInput): Promise<Result<string>>;
}

type ExtractCriteriaInput = {
  rawQuery: string;
  useCase: string;
  uiCriteria?: Record<string, unknown>;
};

type QualifyInput = {
  entity: CompanyData | JobPosting;
  criteria: SearchCriteria;
  scrapedContent: string; // mandatory — we never qualify without content
};

type GenerateDraftInput = { contact: Contact; companyContext: string };

// SearchCriteria — in src/types/index.ts
type SearchCriteria = {
  targetEntity: "company" | "job_offer";
  sector?: string;
  location?: string;
  techStack?: string[];
  employeeRange?: { min: number; max: number };
  targetPersona?: string; // Use Case 4: "CTO", "DRH"
  maxResults?: number; // overrides UseCaseConfig.maxResults
  signalSources: SignalSource[]; // which providers to activate in discover
  searchStrategies: string[]; // Brave queries (for news/funding signals only)
  qualificationCriteria: string[]; // what Claude verifies per entity
};

type SignalSource = "france_travail" | "wttj" | "pappers_search" | "brave";

type QualificationResult = {
  score: number; // 0.0 to 1.0
  reason: string; // readable explanation in French
  matchedCriteria: string[];
};
```

---

## Available Providers

### Search

| Provider     | File              | Free tier       | Status                           |
| ------------ | ----------------- | --------------- | -------------------------------- |
| Brave Search | `search/brave.ts` | 2,000 req/month | Secondary — news/funding signals |
| SerpAPI      | `search/serp.ts`  | 100 req/month   | Backup                           |

**Brave is no longer the primary discovery source.** It handles targeted queries for signals that have no dedicated API (news, funding mentions).

---

### Job Board (primary discovery for "hiring" signals)

| Provider       | File                          | Free tier                     | Status                               |
| -------------- | ----------------------------- | ----------------------------- | ------------------------------------ |
| France Travail | `job-board/france-travail.ts` | Free, unlimited               | Active MVP — official French job API |
| WTTJ           | `job-board/wttj.ts`           | Free (scraping via Firecrawl) | Active MVP — tech startup jobs       |

**France Travail** (ex-Pôle Emploi) is the official French government job API. Free, no rate limit documented for reasonable use. Returns all French job postings including company name.

**WTTJ** (Welcome to the Jungle) exposes a public Algolia index (`wk_cms_organizations_production`) via client-side keys embedded in their page HTML. We query it directly over HTTP — no scraping, no Playwright, no LLM, no Firecrawl credits. The query filters `offices.country_code:FR AND jobs_count > 0` and returns company name + slug. The WTTJ company page URL is constructed from the slug. Keys: `ALGOLIA_APP_ID = "CSEKHVMS53"`, `ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0"`.

---

### Company (French official data)

| Provider       | File                 | Free tier       | Status                                     |
| -------------- | -------------------- | --------------- | ------------------------------------------ |
| SIRENE / INSEE | `company/sirene.ts`  | Completely free | Active — `search()` and `findByName()`     |
| Pappers        | `company/pappers.ts` | 100 req/month   | Credits exhausted — kept as backup adapter |

**SIRENE** is the official French registry — complete legal data, free, unlimited. Used for `search()` (pappers_search signal) and as fallback `findByName()` in the enrich step (job_offer mode).

**Pappers** is disabled in all use case configs (account broken). The adapter is kept in `company/pappers.ts` but not instantiated anywhere. Do not re-enable without verifying the account.

**Domain resolution from company names** — neither SIRENE nor Pappers provide reliable web domains. For the discover step, company names coming from France Travail / WTTJ are resolved to real domains via **Brave Search** (`"Acme SAS" site officiel` → first non-aggregator result). See `discover.ts: resolveDomainForName()`.

Both are **France only**. For international, new adapters will be added.

---

### Scraper

| Provider   | File                    | Free tier            | Status     |
| ---------- | ----------------------- | -------------------- | ---------- |
| Firecrawl  | `scraper/firecrawl.ts`  | 500 credits one-time | Active MVP |
| Playwright | `scraper/playwright.ts` | Free (self-hosted)   | Backup     |

**Firecrawl** is used for:

- Scraping company websites in qualify step (priority pages: /jobs, /recrutement, /team, /about, homepage)
- Scraping company contact pages in enrich step

WTTJ **no longer uses Firecrawl** — it queries the Algolia API directly.

**Credit cost awareness**: each Firecrawl scrape costs 1 credit. With 500 credits total, budget carefully. `scrapedContent` is passed from qualify → enrich to avoid double scraping. The scraper skips pages that look like 404/error pages (detected by keywords in the first 400 chars) and tries the next path.

---

### Email (contacts)

| Provider              | File                 | Free tier                                      | Status         |
| --------------------- | -------------------- | ---------------------------------------------- | -------------- |
| Firecrawl (composite) | `email/firecrawl.ts` | Shares Firecrawl credits                       | Active MVP     |
| Apollo.io             | `email/apollo.ts`    | ~10,000 credits/month (corporate email signup) | Available      |
| Hunter.io             | `email/hunter.ts`    | Requires paid plan                             | Reference only |

**Primary strategy** — `FirecrawlEmailProvider`:

1. Reuse `scrapedContent` from qualify if it contains emails — zero additional cost
2. Scrape `/contact`, `/equipe`, `/team`, `/about` pages
3. Extract emails from content using regex + LLM

**Apollo** remains available as a fallback adapter. Hunter requires a paid plan — not used in MVP.

---

### LLM

| Provider                | File            | Status                                   |
| ----------------------- | --------------- | ---------------------------------------- |
| Any (via Vercel AI SDK) | `llm/vercel.ts` | Single adapter — model passed at runtime |

`VercelLLMProvider` wraps Vercel AI SDK (`generateText` + `generateObject`).
Switching model = changing the model argument in the use case config, not the adapter.

---

## Free Tier Summary for MVP

| Provider       | Free limit            | Risk                                             |
| -------------- | --------------------- | ------------------------------------------------ |
| France Travail | Unlimited             | None                                             |
| SIRENE         | 7 req/s               | Medium — batch calls, don't fire 30 in parallel  |
| Brave Search   | 2,000 req/month       | Medium — now also used for domain resolution     |
| Pappers        | Disabled              | High — account broken, adapter kept but not used |
| Firecrawl      | 500 credits one-time  | High — budget carefully                          |
| WTTJ Algolia   | Free (public keys)    | None — no scraping, direct HTTP to Algolia       |
| Apollo.io      | ~10,000 credits/month | Low                                              |

**Key constraint**: Firecrawl credits. Each company qualification costs 1 credit (scrape). Each WTTJ page costs 1 credit. Plan accordingly.

---

## Adding a New Provider

1. Create the file in `src/lib/providers/[category]/[name].ts`
2. Implement the corresponding interface
3. Register it in the relevant use case configuration
4. Add the new `SignalSource` value in `src/types/index.ts` if it activates in discover
5. Change nothing else
