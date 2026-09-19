import { vi } from "vitest";
import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { CompanySignalProvider } from "@/lib/providers/interfaces/company-signal";
import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type { EntityScorerProvider } from "@/lib/providers/interfaces/entity-scorer";
import type { JobBoardProvider } from "@/lib/providers/interfaces/job-board";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import type { TextExtractorProvider } from "@/lib/providers/interfaces/text-extractor";
import { fakeCompany, fakeQualifiedCompany } from "@/tests/fixtures/company";
import { fakeJobPosting } from "@/tests/fixtures/job-posting";
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

export function makeMockJobBoardProvider(
  overrides?: Partial<JobBoardProvider>,
): JobBoardProvider {
  return {
    name: "MockJobBoard",
    signalSource: "france_travail",
    searchJobs: vi
      .fn()
      .mockResolvedValue({ success: true, data: [fakeJobPosting] }),
    ...overrides,
  };
}

export function makeMockCompanySignalProvider(
  overrides?: Partial<CompanySignalProvider>,
): CompanySignalProvider {
  return {
    name: "MockCompanySignal",
    signalSource: "wttj",
    discoverCompanies: vi.fn().mockResolvedValue({
      success: true,
      data: [{ companyName: "Acme SAS", profileUrl: "https://wttj.co/acme" }],
    }),
    ...overrides,
  };
}

export function makeMockTextExtractorProvider(
  overrides?: Partial<TextExtractorProvider>,
): TextExtractorProvider {
  return {
    name: "MockTextExtractor",
    extractCriteria: vi
      .fn()
      .mockResolvedValue({ success: true, data: fakeCriteria }),
    extractCompanyNames: vi
      .fn()
      .mockResolvedValue({ success: true, data: ["Acme SAS"] }),
    ...overrides,
  };
}

export function makeMockEntityScorerProvider(
  overrides?: Partial<EntityScorerProvider>,
): EntityScorerProvider {
  return {
    name: "MockEntityScorer",
    qualify: vi.fn().mockResolvedValue({
      success: true,
      data: fakeQualifiedCompany.qualification,
    }),
    ...overrides,
  };
}

export function makeMockLLMProvider(
  overrides?: Partial<LLMProvider>,
): LLMProvider {
  return {
    ...makeMockTextExtractorProvider(),
    ...makeMockEntityScorerProvider(),
    ...overrides,
  };
}
