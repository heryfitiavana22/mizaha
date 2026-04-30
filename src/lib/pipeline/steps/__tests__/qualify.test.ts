import { describe, expect, it, vi } from "vitest";
import type {
  QualifiedCompany,
  QualifiedJobOffer,
  SearchCriteria,
} from "@/types";
import { qualify } from "@/lib/pipeline/steps/qualify";
import { fakeCompany } from "@/tests/fixtures/company";
import { fakeJobPosting } from "@/tests/fixtures/job-posting";
import { fakeCriteria } from "@/tests/fixtures/search";
import {
  makeMockLLMProvider,
  makeMockScraperProvider,
} from "@/tests/mocks/providers";

const criteriaJobOffer: SearchCriteria = {
  ...fakeCriteria,
  targetEntity: "job_offer",
};

describe("qualify — company mode", () => {
  it("returns qualified companies above the score threshold", async () => {
    const result = await qualify({
      entities: [fakeCompany],
      criteria: fakeCriteria,
      scraper: makeMockScraperProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].qualification.score).toBe(0.85);
  });

  it("skips company when scrape fails for all pages — continues with others", async () => {
    const anotherCompany = { ...fakeCompany, domain: "beta.fr", name: "Beta" };
    const scraper = makeMockScraperProvider({
      scrape: vi.fn().mockImplementation((url: string) => {
        if (url.includes("acme.fr"))
          return Promise.resolve({
            success: false,
            error: new Error("Timeout"),
          });
        return Promise.resolve({
          success: true,
          data: {
            url,
            title: "Beta",
            content:
              "We are Beta company, a SaaS startup based in Paris, actively hiring a senior full-stack developer. Our stack includes TypeScript, Node.js, and React. We recently closed a Series A funding round and are growing fast. Join our engineering team and help us build the future of B2B software.",
            metadata: {},
          },
        });
      }),
    });

    const result = await qualify({
      entities: [fakeCompany, anotherCompany],
      criteria: fakeCriteria,
      scraper,
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect((result.data as QualifiedCompany[])[0].domain).toBe("beta.fr");
  });

  it("skips company when LLM qualification fails", async () => {
    const llm = makeMockLLMProvider({
      qualify: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("LLM down") }),
    });

    const result = await qualify({
      entities: [fakeCompany],
      criteria: fakeCriteria,
      scraper: makeMockScraperProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("filters out companies below the 0.5 score threshold", async () => {
    const llm = makeMockLLMProvider({
      qualify: vi.fn().mockResolvedValue({
        success: true,
        data: { score: 0.3, reason: "Not relevant", matchedCriteria: [] },
      }),
    });

    const result = await qualify({
      entities: [fakeCompany],
      criteria: fakeCriteria,
      scraper: makeMockScraperProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("returns empty list when no entities are provided", async () => {
    const result = await qualify({
      entities: [],
      criteria: fakeCriteria,
      scraper: makeMockScraperProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("qualify — job_offer mode", () => {
  it("returns qualified job offers using description as content — no scraper call", async () => {
    const scraper = makeMockScraperProvider();

    const result = await qualify({
      entities: [fakeJobPosting],
      criteria: criteriaJobOffer,
      scraper,
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    const offer = (result.data as QualifiedJobOffer[])[0];
    expect(offer.scrapedContent).toBe(fakeJobPosting.description);
    expect(scraper.scrape).not.toHaveBeenCalled();
  });

  it("skips job offer when LLM qualification fails", async () => {
    const llm = makeMockLLMProvider({
      qualify: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("LLM down") }),
    });

    const result = await qualify({
      entities: [fakeJobPosting],
      criteria: criteriaJobOffer,
      scraper: makeMockScraperProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("filters out job offers below the 0.5 score threshold", async () => {
    const llm = makeMockLLMProvider({
      qualify: vi.fn().mockResolvedValue({
        success: true,
        data: { score: 0.2, reason: "Not matching", matchedCriteria: [] },
      }),
    });

    const result = await qualify({
      entities: [fakeJobPosting],
      criteria: criteriaJobOffer,
      scraper: makeMockScraperProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});
