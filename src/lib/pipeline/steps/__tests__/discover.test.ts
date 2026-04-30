import { describe, expect, it, vi } from "vitest";
import type { CompanyData } from "@/types";
import { discover } from "@/lib/pipeline/steps/discover";
import { fakeCompany } from "@/tests/fixtures/company";
import { fakeCriteria } from "@/tests/fixtures/search";
import {
  makeMockCompanyProvider,
  makeMockLLMProvider,
  makeMockSearchProvider,
} from "@/tests/mocks/providers";

describe("discover", () => {
  it("returns companies extracted by LLM from search results", async () => {
    const result = await discover({
      criteria: fakeCriteria,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect((result.data as CompanyData[])[0].domain).toBe(fakeCompany.domain);
  });

  it("returns failure when all search strategies fail", async () => {
    const error = new Error("Search API down");
    const search = makeMockSearchProvider({
      search: vi.fn().mockResolvedValue({ success: false, error }),
    });

    const result = await discover({
      criteria: fakeCriteria,
      search,
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(false);
  });

  it("returns empty when LLM extracts no companies", async () => {
    const llm = makeMockLLMProvider({
      extractCompanyNames: vi
        .fn()
        .mockResolvedValue({ success: true, data: [] }),
    });

    const result = await discover({
      criteria: fakeCriteria,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("deduplicates companies that resolve to the same domain", async () => {
    const llm = makeMockLLMProvider({
      extractCompanyNames: vi
        .fn()
        .mockResolvedValue({ success: true, data: ["Acme SAS", "Acme"] }),
    });
    // Both names resolve to the same domain via the same mock search
    const result = await discover({
      criteria: fakeCriteria,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
  });

  it("builds minimal company from domain when registry returns null", async () => {
    const company = makeMockCompanyProvider({
      findByDomain: vi.fn().mockResolvedValue({ success: true, data: null }),
    });

    const result = await discover({
      criteria: fakeCriteria,
      search: makeMockSearchProvider(),
      company,
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect((result.data as CompanyData[])[0].domain).toBe("acme.fr");
  });

  it("uses searchStrategies from criteria as search queries", async () => {
    const search = makeMockSearchProvider();

    await discover({
      criteria: fakeCriteria,
      search,
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    const queries = vi.mocked(search.search).mock.calls.map((c) => c[0].query);
    for (const strategy of fakeCriteria.searchStrategies) {
      expect(queries).toContain(strategy);
    }
  });
});
