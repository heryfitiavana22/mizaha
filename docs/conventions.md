# Code Conventions

## Guiding Philosophy

**Don't just make it work. Make it right.**

Writing code that runs is the minimum. The real goal is code that:

- Is easy to read and understand by anyone (including yourself in 6 months)
- Is maintainable — changing one thing doesn't break five others
- Is designed for the future — doesn't need to be rewritten every time requirements evolve
- Has no shortcuts, no hacks, no "we'll fix it later"

When writing a feature, ask yourself:

> "Is this code I'm proud of, or code I just want to get rid of?"

If the answer is the second — stop, think, and write it properly.

---

These conventions apply to all Mizaha code without exception.

---

## 1. Errors as Values

Never `throw` in business logic. Functions return a `Result`.

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: Error };
```

**Why**: exceptions hide error cases. With a Result, every caller is forced to explicitly handle the failure case.

```typescript
// CORRECT
async function scrape({ url }: ScrapeOptions): Promise<Result<ScrapedContent>> {
  try {
    const content = await firecrawl.scrape(url);
    return { success: true, data: content };
  } catch (e) {
    return { success: false, error: new Error(`Scrape failed: ${e.message}`) };
  }
}

// FORBIDDEN
async function scrape(url: string): Promise<ScrapedContent> {
  return await firecrawl.scrape(url); // can throw silently
}
```

---

## 2. Object Parameters

Never pass inline parameters. Always use a typed object.

```typescript
// CORRECT
function qualify({
  company,
  criteria,
  useCase,
}: QualifyOptions): Promise<Result<QualificationResult>> {}

// FORBIDDEN
function qualify(
  company: CompanyData,
  criteria: SearchCriteria,
  useCase: string,
) {}
```

**Why**:

- Argument order no longer matters
- Adding a new parameter doesn't break any existing call
- The call site is readable without looking at the signature

---

## 3. TypeScript Strict — No `any`

`any` is forbidden. If the type is unknown, use `unknown` and validate.

```typescript
// CORRECT
function parseResponse(data: unknown): Result<CompanyData> {}

// FORBIDDEN
function parseResponse(data: any): CompanyData {}
```

---

## 4. Pure Functions for the Pipeline

Each pipeline step is a pure function: same input → same output, no hidden side effects.

Side effects (writing to DB, API calls) happen only in `pipeline/index.ts`, not in the steps themselves.

```typescript
// CORRECT — pure step
async function qualify({
  companies,
  criteria,
}: QualifyOptions): Promise<Result<QualifiedCompany[]>> {
  // transforms data, doesn't touch the database
}

// FORBIDDEN — side effect in a step
async function qualify({ companies, criteria }: QualifyOptions) {
  const results = await process(companies);
  await db.insert(results); // hidden side effect
}
```

---

## 5. Descriptive Names — No Abbreviations

Code reads like text. No abbreviations, no single-letter names except in loops.

```typescript
// CORRECT
const extractedCriteria = await extractCriteria({ rawQuery, useCase });
const qualifiedCompanies = await qualify({ companies, criteria });

// FORBIDDEN
const ec = await extract(rq, uc);
const qc = await qualify(c, cr);
```

---

## 6. Comments Only for the WHY

Don't comment what the code does — names should explain that.
Only comment when a non-obvious decision was made.

```typescript
// CORRECT
// Hunter returns max 3 contacts per domain on the free tier — take the first one
const contact = contacts[0];

// FORBIDDEN
// Get the first contact from the list
const contact = contacts[0];
```

---

## 7. Isolated Utility Functions

A pure utility function does not live inside a use-case, provider, or pipeline step.
It goes in `src/lib/utils/` — accessible everywhere, testable alone.

```typescript
// CORRECT — in src/lib/utils/url.ts
export function extractDomain({ url }: { url: string }): string {
  return new URL(url).hostname.replace('www.', '');
}

// FORBIDDEN — buried inside a provider
// src/lib/providers/search/brave.ts
function extractDomain(url: string) { ... } // inaccessible elsewhere
```

**Important caveat**: `utils/` must not become a dumping ground.
Before adding something, ask: is this truly a pure generic function, or does it belong to a specific layer?
Decide case by case while coding, not in advance.

---

## 8. One Component Per File

One React file = one component. Never multiple components in the same file.
File name in **kebab-case**. **Named export**, never default.

```typescript
// CORRECT
// components/companies/company-card.tsx
export function CompanyCard() {}

// components/companies/company-list.tsx
export function CompanyList() {}

// FORBIDDEN — multiple components in one file
// components/companies/index.tsx
export function CompanyCard() {}
export function CompanyList() {}
export function CompanyBadge() {}

// FORBIDDEN — default export
export default CompanyCard;
```

**Why kebab-case**: consistency with Next.js conventions and the file system.
**Why named export**: IDEs find references better, refactors are safer, no confusion on the import name.

---

## 9. Tests

### Framework

**Vitest** — TypeScript native, fast, Jest-compatible API.

### Folder Structure

Tests live in a `__tests__/` folder inside each module.
Not mixed with source files, but always close.

```text
src/lib/pipeline/steps/
├── discover.ts
├── qualify.ts
├── enrich.ts
└── __tests__/
    ├── discover.test.ts
    ├── qualify.test.ts
    └── enrich.test.ts

src/lib/utils/
├── url.ts
└── __tests__/
    └── url.test.ts

src/lib/providers/search/
├── brave.ts
└── __tests__/
    └── brave.test.ts

src/tests/                   → shared test utilities
├── fixtures/                → reusable test data (e.g.: fake company)
├── mocks/                   → HTTP mocks, provider mocks
└── helpers/                 → test utility functions
```

### Test Types

**Unit** (`*.test.ts`) — one function in isolation, everything else mocked
**Integration** (`*.int.test.ts`) — multiple modules together, real local DB but mocked providers
**E2E** — completely ignored (costs real API credits)

### File Naming

```text
discover.test.ts        → unit
discover.int.test.ts    → integration
```

### What We Test

| What              | Type        | Why                                          |
| ----------------- | ----------- | -------------------------------------------- |
| Pipeline steps    | Unit        | Pure functions → zero mocks needed           |
| Utils             | Unit        | Pure by definition → always tested           |
| Provider adapters | Unit        | HTTP mock — validate response transformation |
| Full pipeline     | Integration | Real local DB + mocked providers             |

### What We Do NOT Test

| What                  | Why                        |
| --------------------- | -------------------------- |
| UI / React components | Too complex for this stage |
| Full E2E              | Real APIs cost credits     |

### Rule

Pipeline steps being pure functions, they must be testable without mocking the database or external APIs.
If a step needs a mock to be tested, it's a sign it has a hidden side effect — review convention 4.

---

## 10. Short Functions — Single Responsibility

A function does one thing. If it does two things, split it into two functions.
No function longer than ~30 lines. If it's longer, it's doing too much.

```typescript
// CORRECT — each function has one job
async function fetchCompanyData({ domain }: { domain: string }) { ... }
async function scoreCompany({ company, criteria }: ScoreOptions) { ... }

// FORBIDDEN — one function doing everything
async function fetchAndScoreAndSaveCompany({ domain, criteria, searchId }) {
  // 80 lines doing fetch + score + save + log + ...
}
```

---

## 11. No Magic Numbers or Strings

Never hardcode a value directly. Use a named constant.

```typescript
// CORRECT
const MAX_RESULTS_PER_SEARCH = 20
const SCRAPE_TIMEOUT_MS = 10_000

if (results.length > MAX_RESULTS_PER_SEARCH) { ... }

// FORBIDDEN
if (results.length > 20) { ... }
setTimeout(fn, 10000)
```

---

## 12. Early Return

Return early instead of nesting conditions. Less indentation = more readable.

```typescript
// CORRECT
async function qualify({ company, criteria }: QualifyOptions) {
  if (!company.website)
    return { success: false, error: new Error("No website") };
  if (!criteria.signals.length)
    return { success: false, error: new Error("No signals") };

  // main logic here, flat and clear
}

// FORBIDDEN
async function qualify({ company, criteria }: QualifyOptions) {
  if (company.website) {
    if (criteria.signals.length) {
      // main logic buried under two levels of nesting
    }
  }
}
```

---

## 13. Immutability

Prefer `const`. Never mutate an object received as a parameter — return a new one.

```typescript
// CORRECT
const updatedCompany = { ...company, score: 0.9 };

// FORBIDDEN
company.score = 0.9; // mutates the original object
```

---

## 14. Everything in English

All code is written in English without exception:

- Variable names, functions, types, interfaces
- File and folder names
- Comments in the code
- Commit messages

**The only exception**: user-facing content (UI text displayed to the user, query examples in docs representing what French users type).

```typescript
// CORRECT
const extractedCriteria = await extractCriteria({ rawQuery, useCase });
const qualifiedCompanies = results.filter(isRelevant);

// FORBIDDEN
const criteresExtraits = await extraireCriteres({ requeteBrute, casUsage });
```
