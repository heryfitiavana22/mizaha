import { describe, expect, it, vi } from "vitest";
import type { QualifiedCompany } from "@/types";
import { qualify } from "@/lib/pipeline/steps/qualify";
import { fakeCompany } from "@/tests/fixtures/company";
import { fakeCriteria } from "@/tests/fixtures/search";
import {
  makeMockLLMProvider,
  makeMockScraperProvider,
} from "@/tests/mocks/providers";

describe("qualify", () => {
  it("returns qualified companies", async () => {
    const scraper = makeMockScraperProvider();
    const llm = makeMockLLMProvider();

    const result = await qualify({
      entities: [fakeCompany],
      criteria: fakeCriteria,
      scraper,
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].qualification.score).toBe(0.85);
  });

  it("skips company when scrape fails (error level 3) — continues with others", async () => {
    const anotherCompany = { ...fakeCompany, domain: "beta.fr", name: "Beta" };
    const scraper = makeMockScraperProvider({
      // scrapeWithFallback tries up to 9 URLs per company — fail all acme.fr, succeed for beta.fr
      scrape: vi.fn().mockImplementation((url: string) => {
        if (url.includes("acme.fr")) {
          return Promise.resolve({
            success: false,
            error: new Error("Timeout"),
          });
        }
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
    const llm = makeMockLLMProvider();

    const result = await qualify({
      entities: [fakeCompany, anotherCompany],
      criteria: fakeCriteria,
      scraper,
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // First company scrape failed — skipped; second is returned
    expect(result.data).toHaveLength(1);
    expect((result.data as QualifiedCompany[])[0].domain).toBe("beta.fr");
  });

  it("skips company when llm qualify fails", async () => {
    const scraper = makeMockScraperProvider();
    const llm = makeMockLLMProvider({
      qualify: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("LLM down") }),
    });

    const result = await qualify({
      entities: [fakeCompany],
      criteria: fakeCriteria,
      scraper,
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("returns empty list when no companies are provided", async () => {
    const result = await qualify({
      entities: [],
      criteria: fakeCriteria,
      scraper: makeMockScraperProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result).toEqual({ success: true, data: [] });
  });
});
