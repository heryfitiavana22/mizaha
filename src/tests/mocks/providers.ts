import { vi } from "vitest";
import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import { fakeCompany, fakeQualifiedCompany } from "@/tests/fixtures/company";
import { fakeCriteria } from "@/tests/fixtures/search";

export function makeMockSearchProvider(
  overrides?: Partial<SearchProvider>,
): SearchProvider {
  return {
    name: "MockSearch",
    search: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { url: "https://acme.fr", title: "Acme SAS", snippet: "SaaS company" },
      ],
    }),
    ...overrides,
  };
}

export function makeMockCompanyProvider(
  overrides?: Partial<CompanyProvider>,
): CompanyProvider {
  return {
    name: "MockCompany",
    findByDomain: vi
      .fn()
      .mockResolvedValue({ success: true, data: fakeCompany }),
    findByName: vi.fn().mockResolvedValue({ success: true, data: fakeCompany }),
    search: vi.fn().mockResolvedValue({ success: true, data: [fakeCompany] }),
    ...overrides,
  };
}

export function makeMockScraperProvider(
  overrides?: Partial<ScraperProvider>,
): ScraperProvider {
  return {
    name: "MockScraper",
    scrape: vi.fn().mockResolvedValue({
      success: true,
      data: {
        url: "https://acme.fr",
        title: "Acme SAS",
        content:
          "We are a SaaS company based in Paris. We are actively hiring a senior React developer to join our growing engineering team. Our stack includes TypeScript, Node.js, and React. We recently raised a Series A and are expanding rapidly. Contact us at jobs@acme.fr.",
        metadata: {},
      },
    }),
    ...overrides,
  };
}

export function makeMockEmailProvider(
  overrides?: Partial<EmailProvider>,
): EmailProvider {
  return {
    name: "MockEmail",
    findByDomain: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          name: "Alice Martin",
          title: "CTO",
          email: "alice@acme.fr",
          confidence: 90,
        },
      ],
    }),
    findContact: vi.fn().mockResolvedValue({ success: true, data: null }),
    ...overrides,
  };
}

export function makeMockLLMProvider(
  overrides?: Partial<LLMProvider>,
): LLMProvider {
  return {
    name: "MockLLM",
    extractCriteria: vi
      .fn()
      .mockResolvedValue({ success: true, data: fakeCriteria }),
    extractCompanyNames: vi
      .fn()
      .mockResolvedValue({ success: true, data: ["Acme SAS"] }),
    qualify: vi.fn().mockResolvedValue({
      success: true,
      data: fakeQualifiedCompany.qualification,
    }),
    generateDraft: vi
      .fn()
      .mockResolvedValue({ success: true, data: "Bonjour Alice," }),
    ...overrides,
  };
}
