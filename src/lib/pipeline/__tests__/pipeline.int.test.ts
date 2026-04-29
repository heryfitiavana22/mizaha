import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  companies,
  pipelineRuns,
  searchCompanies,
  searches,
} from "@/lib/db/schema";
import { resetTestDb } from "@/tests/helpers/db";
import {
  makeMockCompanyProvider,
  makeMockEmailProvider,
  makeMockLLMProvider,
  makeMockScraperProvider,
  makeMockSearchProvider,
} from "@/tests/mocks/providers";

vi.mock("@/lib/use-cases", () => ({
  getUseCase: vi.fn(),
}));

// Import after mock is set up
const { runPipeline } = await import("@/lib/pipeline");
const { getUseCase } = await import("@/lib/use-cases");

function makeTestProviders() {
  return {
    search: { primary: makeMockSearchProvider() },
    company: { primary: makeMockCompanyProvider() },
    scraper: { primary: makeMockScraperProvider() },
    email: { primary: makeMockEmailProvider() },
    llm: makeMockLLMProvider(),
  };
}

async function createTestSearch(): Promise<string> {
  const [row] = await db
    .insert(searches)
    .values({
      rawQuery: "startups React Paris",
      criteria: {},
      useCase: "freelance",
      status: "pending",
    })
    .returning({ id: searches.id });
  return row.id;
}

describe("runPipeline (integration)", () => {
  beforeEach(async () => {
    await resetTestDb();
    vi.mocked(getUseCase).mockReturnValue({
      success: true,
      data: {
        name: "freelance",
        description: "Test use case",
        enrichStrategy: "domain",
        maxResults: 20,
        providers: makeTestProviders(),
      },
    });
  });

  afterAll(async () => {
    await resetTestDb();
  });

  it("sets search status to completed after a successful run", async () => {
    const searchId = await createTestSearch();

    await runPipeline({ searchId, useCaseName: "freelance" });

    const [search] = await db
      .select({ status: searches.status })
      .from(searches)
      .where(eq(searches.id, searchId));

    expect(search.status).toBe("completed");
  });

  it("creates pipeline_runs rows for each step", async () => {
    const searchId = await createTestSearch();

    await runPipeline({ searchId, useCaseName: "freelance" });

    const runs = await db
      .select({ step: pipelineRuns.step, status: pipelineRuns.status })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.searchId, searchId));

    const steps = runs.map((r) => r.step);
    expect(steps).toContain("extract-criteria");
    expect(steps).toContain("discover");
    expect(steps).toContain("qualify");
    expect(steps).toContain("enrich");
    expect(runs.every((r) => r.status === "completed")).toBe(true);
  });

  it("saves company and links it to the search", async () => {
    const searchId = await createTestSearch();

    await runPipeline({ searchId, useCaseName: "freelance" });

    const links = await db
      .select()
      .from(searchCompanies)
      .where(eq(searchCompanies.searchId, searchId));

    expect(links).toHaveLength(1);
    expect(links[0].relevanceScore).toBe(0.85);
  });

  it("deduplicates companies — same domain across two searches shares one companies row", async () => {
    const searchId1 = await createTestSearch();
    const searchId2 = await createTestSearch();

    await runPipeline({ searchId: searchId1, useCaseName: "freelance" });
    await runPipeline({ searchId: searchId2, useCaseName: "freelance" });

    const allCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.domain, "acme.fr"));

    expect(allCompanies).toHaveLength(1);

    const links1 = await db
      .select()
      .from(searchCompanies)
      .where(eq(searchCompanies.searchId, searchId1));
    const links2 = await db
      .select()
      .from(searchCompanies)
      .where(eq(searchCompanies.searchId, searchId2));

    expect(links1[0].companyId).toBe(links2[0].companyId);
  });

  it("sets search status to failed when extract-criteria fails", async () => {
    const error = new Error("LLM down");
    vi.mocked(getUseCase).mockReturnValue({
      success: true,
      data: {
        name: "freelance",
        description: "Test",
        enrichStrategy: "domain",
        maxResults: 20,
        providers: {
          ...makeTestProviders(),
          llm: makeMockLLMProvider({
            extractCriteria: vi
              .fn()
              .mockResolvedValue({ success: false, error }),
          }),
        },
      },
    });

    const searchId = await createTestSearch();
    await runPipeline({ searchId, useCaseName: "freelance" });

    const [search] = await db
      .select({ status: searches.status })
      .from(searches)
      .where(eq(searches.id, searchId));

    expect(search.status).toBe("failed");
  });
});
