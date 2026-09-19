import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  entities,
  pipelineRuns,
  searchResults,
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
    search: makeMockSearchProvider(),
    company: makeMockCompanyProvider(),
    scraper: makeMockScraperProvider(),
    email: makeMockEmailProvider(),
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
        targetEntity: "company",
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

    const steps = runs.map((run) => run.step);
    expect(steps).toContain("extract-criteria");
    expect(steps).toContain("discover");
    expect(steps).toContain("qualify");
    expect(steps).toContain("enrich");
    expect(runs.every((run) => run.status === "completed")).toBe(true);
  });

  it("saves entity and links it to the search", async () => {
    const searchId = await createTestSearch();

    await runPipeline({ searchId, useCaseName: "freelance" });

    const links = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId));

    expect(links).toHaveLength(1);
    expect(links[0].score).toBe(0.85);
  });

  it("deduplicates entities — same domain across two searches shares one entities row", async () => {
    const searchId1 = await createTestSearch();
    const searchId2 = await createTestSearch();

    await runPipeline({ searchId: searchId1, useCaseName: "freelance" });
    await runPipeline({ searchId: searchId2, useCaseName: "freelance" });

    const allEntities = await db
      .select()
      .from(entities)
      .where(eq(entities.dedupKey, "acme.fr"));

    expect(allEntities).toHaveLength(1);

    const links1 = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId1));
    const links2 = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId2));

    expect(links1[0].entityId).toBe(links2[0].entityId);
  });

  it("sets search status to failed when extract-criteria fails", async () => {
    const error = new Error("LLM down");
    vi.mocked(getUseCase).mockReturnValue({
      success: true,
      data: {
        name: "freelance",
        description: "Test",
        targetEntity: "company",
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
