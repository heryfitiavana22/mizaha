# Architecture Improvements

Deepening opportunities identified by `/improve-codebase-architecture`. Check each item off when done.

---

## [x] 1. Bimodal branching spread across three pipeline steps

**Files:** `steps/discover.ts`, `steps/qualify.ts`, `steps/enrich.ts`

**Problem:** Every step checks `criteria.targetEntity` at its top and branches to entirely separate code paths. This is the same seam leaking into three modules. Discover has `discoverCompanies` / `discoverJobOffers`. Qualify has `qualifyCompanies` / `qualifyJobOffers`. Enrich has `enrichCompanies` / `enrichJobOffers`. Each step is a shallow switch, and the real logic is buried in private branches that can't be tested independently.

**Solution:** Define an `EntityStrategy` interface (two methods: `collectEntities`, `processEntity`) with a `CompanyStrategy` and `JobOfferStrategy` adapter. Each step becomes entity-agnostic: it receives a strategy and maps over entities uniformly. The `targetEntity` branch disappears from all three steps.

**Benefits:** Locality — adding a third entity type is one new adapter file instead of six new branches. Leverage — each step's interface shrinks to the common contract, so tests exercise real entity-type logic rather than dispatch logic. The strategy adapters become the natural unit-test surface.

---

## [x] 2. `extract-criteria.ts` fails the deletion test

**File:** `steps/extract-criteria.ts`

**Problem:** 19 lines. One public function. The entire body is `return llm.extractCriteria(input)`. No validation, no transformation, no error shaping beyond what the LLM provider already returns. If you delete this file and call `llm.extractCriteria` directly in the orchestrator, zero complexity reappears anywhere. It's a phantom module that inflates the pipeline's apparent symmetry.

**Solution:** Delete it. Move the single call site into the orchestrator's existing `runExtractCriteria` wrapper, or — if criteria extraction deserves its own seam — define what that seam should actually hide (input validation, output normalisation, use-case-specific prompting). Right now there's nothing behind it.

**Benefits:** Removes a module with zero depth. Makes the remaining steps feel more meaningful by comparison. If criteria extraction does grow a real body, the seam gets created at that point with something real behind it (one adapter = hypothetical seam; two adapters = real seam).

---

## [x] 3. Provider fallback assembled inside the orchestrator, not at a seam

**Files:** `pipeline/index.ts`, `use-cases/freelance-client.ts`, `use-cases/find-jobs.ts`

**Problem:** The primary → backup provider chain is assembled inside the orchestrator's per-step runner functions (`createFallbackCompanyProvider` is called inline). The orchestrator ends up knowing both what step to run and which provider to try. The use-case configs define `primary` / `backup` slots, but the logic for wiring them into a fallback composite lives elsewhere, inconsistently, and is never tested in isolation.

**Solution:** Introduce a `withFallback(primary, backup)` (at `compose.ts`) composer that returns a provider satisfying the same interface. Call it at use-case config construction time, not inside the orchestrator. The orchestrator receives a single provider per type — it doesn't know whether it has fallback logic or not.

**Benefits:** Locality — fallback logic lives once, at the seam where providers are assembled. Leverage — every provider type gets fallback for free. The composer becomes independently testable: inject two adapters, simulate failure on the primary, verify the backup fires.

---

## [x] 4. `LLMProvider` bundles four unrelated concerns

**Files:** `src/lib/providers/interfaces/llm.ts`, `src/lib/providers/llm/vercel.ts`

**Problem:** `extractCriteria`, `extractCompanyNames`, `qualify`, and `generateDraft` are four different operations with entirely different input shapes, used by different steps, serving different callers. The interface surface is as complex as the sum of all four method signatures. Callers who only need `qualify` must mock all four methods. Callers who only need `extractCompanyNames` must know about `GenerateDraftInput`.

**Solution:** Split into narrower role interfaces — at minimum separating extraction (`extractCriteria`, `extractCompanyNames`) from scoring (`qualify`) from generation (`generateDraft`). Each pipeline step declares the narrower interface it needs. The Vercel adapter can implement all three; test doubles only implement the one under test.

**Benefits:** Leverage — each caller's interface shrinks to what it actually needs. Locality — if `qualify` changes its input contract, only the qualify step and its tests are affected. Each role interface becomes an independent, testable seam.

---

## [x] 5. `WttjCompanyProvider` misregistered behind `JobBoardProvider`

**File:** `src/lib/providers/job-board/wttj.ts`

**Problem:** `WttjCompanyProvider.searchJobs` returns `JobPosting[]` with empty `title`, `contractType`, and `description`. WTTJ's Algolia endpoint searches organisations, not job listings — so the data was never there to begin with. The provider satisfies the `JobBoardProvider` interface in name but violates it in contract, causing silent downstream failures in qualify (scores an empty description) and enrich (misses company data).

**Solution:** Decide which seam WTTJ actually belongs to. If it discovers companies via hiring signals, it belongs behind a `CompanyDiscoverySource` interface (not `JobBoardProvider`). If job-posting data is needed from WTTJ, the Firecrawl-based `wttj-jobs.ts` (currently inactive) is the correct adapter. Either way, the current registration is wrong and the interface violation should be explicit.

**Benefits:** Correctness first. Then clarity: the `JobBoardProvider` interface regains honest semantics, and downstream steps can trust that a `JobPosting` returned by any registered adapter has a non-empty description.
