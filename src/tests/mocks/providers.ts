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
    findByDomain: vi
      .fn()
      .mockResolvedValue({ success: true, data: fakeCompany }),
    search: vi.fn().mockResolvedValue({ success: true, data: [fakeCompany] }),
    ...overrides,
  };
}

export function makeMockScraperProvider(
  overrides?: Partial<ScraperProvider>,
): ScraperProvider {
  return {
    scrape: vi.fn().mockResolvedValue({
      success: true,
      data: {
        url: "https://acme.fr",
        title: "Acme SAS",
        content: "We are a SaaS company hiring a React developer",
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
    extractCriteria: vi
      .fn()
      .mockResolvedValue({ success: true, data: fakeCriteria }),
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
