# External Providers

## Principle

Code against **TypeScript interfaces**, never against SDKs directly.
Changing a provider = modifying one file in `src/lib/providers/[category]/`.
The rest of the code doesn't know which provider is being used.

---

## The 5 Interfaces

### `SearchProvider`

Company discovery via web search.
Types live in `src/lib/providers/interfaces/search.ts`.

```typescript
// SearchOptions, SearchInput — in interfaces/search.ts
// SearchResult — in src/types/index.ts (used across pipeline)

interface SearchProvider {
  search(input: SearchInput): Promise<Result<SearchResult[]>>;
}

type SearchOptions = { country?: string; limit?: number };
type SearchInput = { query: string; options?: SearchOptions };
```

---

### `CompanyProvider`

Official company data (registries, legal databases).
Types live in `src/lib/providers/interfaces/company.ts`.

```typescript
// CompanyCriteria — in interfaces/company.ts

interface CompanyProvider {
  findByDomain(domain: string): Promise<Result<CompanyData | null>>;
  search(criteria: CompanyCriteria): Promise<Result<CompanyData[]>>;
}

type CompanyCriteria = {
  sector?: string;
  location?: string;
  minEmployees?: number;
  maxEmployees?: number;
};

// CompanyData — in src/types/index.ts (used across pipeline)
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

### `ScraperProvider`

Content extraction from a website.
Types live in `src/lib/providers/interfaces/scraper.ts`.

```typescript
// ScrapedContent — in interfaces/scraper.ts

interface ScraperProvider {
  scrape(url: string): Promise<Result<ScrapedContent>>;
}

type ScrapedContent = {
  url: string;
  title: string;
  content: string;
  metadata: Record<string, string>;
};
```

---

### `EmailProvider`

Contact and email search by domain.
Types live in `src/lib/providers/interfaces/email.ts`.

```typescript
// FindContactInput — in interfaces/email.ts

interface EmailProvider {
  findByDomain(domain: string): Promise<Result<Contact[]>>;
  findContact(input: FindContactInput): Promise<Result<Contact | null>>;
}

type FindContactInput = { name: string; domain: string };

// Contact — in src/types/index.ts (used across pipeline)
type Contact = {
  name?: string;
  title?: string;
  email: string;
  confidence: number; // confidence score 0-100
  linkedinUrl?: string;
};
```

---

### `LLMProvider`

Language model calls.
Types live in `src/lib/providers/interfaces/llm.ts`.

```typescript
// ExtractCriteriaInput, QualifyInput, GenerateDraftInput — in interfaces/llm.ts
interface LLMProvider {
  extractCriteria(input: ExtractCriteriaInput): Promise<Result<SearchCriteria>>;
  qualify(input: QualifyInput): Promise<Result<QualificationResult>>;
  generateDraft(input: GenerateDraftInput): Promise<Result<string>>;
}

type ExtractCriteriaInput = { rawQuery: string; useCase: string };
type QualifyInput = { company: CompanyData; criteria: SearchCriteria };
type GenerateDraftInput = { contact: Contact; companyContext: string };

// SearchCriteria, QualificationResult, CompanyData, Contact — in src/types/index.ts
type SearchCriteria = {
  sector?: string;
  location?: string;
  signals: string[]; // e.g.: ["recently_funded", "hiring_dev"]
  techStack?: string[];
  employeeRange?: { min: number; max: number };
};

type QualificationResult = {
  score: number; // 0.0 to 1.0
  reason: string; // readable explanation
  matchedSignals: string[];
};
```

---

## Available Providers

### Search (discovery)

| Provider     | File              | Free tier       | Status     |
| ------------ | ----------------- | --------------- | ---------- |
| Brave Search | `search/brave.ts` | 2,000 req/month | Active MVP |
| SerpAPI      | `search/serp.ts`  | 100 req/month   | Backup     |

**Brave Search** is the primary. Better free tier, independent from Google.

---

### Company (official French data)

| Provider       | File                 | Free tier       | Status     |
| -------------- | -------------------- | --------------- | ---------- |
| Pappers        | `company/pappers.ts` | 100 req/month   | Active MVP |
| SIRENE / INSEE | `company/sirene.ts`  | Completely free | Active MVP |

**SIRENE** is the official French registry — complete legal data, free.
**Pappers** enriches with additional data (executives, accounts, etc.).

Both providers are **France only**. For international, other providers will be added later.

---

### Scraper (content extraction)

| Provider   | File                    | Free tier            | Status                           |
| ---------- | ----------------------- | -------------------- | -------------------------------- |
| Firecrawl  | `scraper/firecrawl.ts`  | 500 credits one-time | Active MVP                       |
| Playwright | `scraper/playwright.ts` | Free (self-hosted)   | Backup if Firecrawl insufficient |

**Firecrawl** first — simple API, good extraction.
**Playwright** as backup if volume exceeds the free tier or JS rendering is needed.

---

### Email (contacts)

| Provider  | File              | Free tier        | Status     |
| --------- | ----------------- | ---------------- | ---------- |
| Hunter.io | `email/hunter.ts` | 25 req/month     | Active MVP |
| Apollo.io | `email/apollo.ts` | 50 credits/month | Backup     |

Both are very limited on the free tier. Monitor as a priority if volume increases.

---

### LLM

| Provider | File            | Status                                   |
| -------- | --------------- | ---------------------------------------- |
| Any      | `llm/vercel.ts` | Single adapter — model passed at runtime |

`VercelLLMProvider` wraps Vercel AI SDK (`generateText` + `Output.object()`).
Switching from Claude to OpenAI = changing the model argument in the use case config, not the adapter.

---

## Free Tier Summary for MVP

| Provider     | Free limit           | Risk                 |
| ------------ | -------------------- | -------------------- |
| Brave Search | 2,000 req/month      | Low                  |
| SIRENE       | Unlimited            | None                 |
| Pappers      | 100 req/month        | Medium               |
| Firecrawl    | 500 credits one-time | High — one-time only |
| Hunter.io    | 25 req/month         | High — very limited  |
| Apollo.io    | 50 credits/month     | High — very limited  |

**Key bottleneck**: Hunter and Apollo are the free tier choke points.
If volume increases, consider Playwright + direct site scraping for contacts.

---

## Adding a New Provider

1. Create the file in `src/lib/providers/[category]/[name].ts`
2. Implement the corresponding interface
3. Register it in the relevant use case configuration
4. Change nothing else
