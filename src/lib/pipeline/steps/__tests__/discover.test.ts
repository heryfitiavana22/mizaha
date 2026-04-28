import { describe, expect, it, vi } from "vitest";
import { discover } from "@/lib/pipeline/steps/discover";
import { fakeCompany } from "@/tests/fixtures/company";
import { fakeCriteria } from "@/tests/fixtures/search";
import {
  makeMockCompanyProvider,
  makeMockSearchProvider,
} from "@/tests/mocks/providers";

describe("discover", () => {
  it("returns found companies", async () => {
    const search = makeMockSearchProvider();
    const company = makeMockCompanyProvider();

    const result = await discover({ criteria: fakeCriteria, search, company });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].domain).toBe(fakeCompany.domain);
  });

  it("returns failure when search provider fails", async () => {
    const error = new Error("Search API down");
    const search = makeMockSearchProvider({
      search: vi.fn().mockResolvedValue({ success: false, error }),
    });
    const company = makeMockCompanyProvider();

    const result = await discover({ criteria: fakeCriteria, search, company });

    expect(result).toEqual({ success: false, error });
  });

  it("deduplicates companies with the same domain", async () => {
    const search = makeMockSearchProvider({
      search: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { url: "https://acme.fr/page1", title: "Acme", snippet: "" },
          { url: "https://www.acme.fr/page2", title: "Acme", snippet: "" },
        ],
      }),
    });
    const company = makeMockCompanyProvider();

    const result = await discover({ criteria: fakeCriteria, search, company });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // Both URLs resolve to acme.fr — only one company in output
    expect(result.data).toHaveLength(1);
  });

  it("builds minimal company from search result when provider returns null", async () => {
    const company = makeMockCompanyProvider({
      findByDomain: vi.fn().mockResolvedValue({ success: true, data: null }),
    });

    const result = await discover({
      criteria: fakeCriteria,
      search: makeMockSearchProvider(),
      company,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    // When provider returns null, discover still includes the domain with minimal data
    // so qualify can scrape the site and fill in the context
    expect(result.data).toHaveLength(1);
    expect(result.data[0].domain).toBe("acme.fr");
    expect(result.data[0].name).toBe("Acme SAS");
  });

  it("builds query from criteria fields", async () => {
    const search = makeMockSearchProvider();
    const company = makeMockCompanyProvider();

    await discover({ criteria: fakeCriteria, search, company });

    const calledWith = vi.mocked(search.search).mock.calls[0][0];
    expect(calledWith.query).toContain("SaaS");
    expect(calledWith.query).toContain("Paris");
  });
});
