import { describe, expect, it, vi } from "vitest";
import type { CompanyData, JobPosting, SearchCriteria } from "@/types";
import { discover } from "@/lib/pipeline/steps/discover";
import { fakeCompany } from "@/tests/fixtures/company";
import { fakeJobPosting } from "@/tests/fixtures/job-posting";
import { fakeCriteria } from "@/tests/fixtures/search";
import {
  makeMockCompanyProvider,
  makeMockJobBoardProvider,
  makeMockLLMProvider,
  makeMockSearchProvider,
} from "@/tests/mocks/providers";

const criteriaWithPappers: SearchCriteria = {
  ...fakeCriteria,
  signalSources: ["pappers_search"],
};

const criteriaWithBrave: SearchCriteria = {
  ...fakeCriteria,
  signalSources: ["brave"],
};

const criteriaJobOffer: SearchCriteria = {
  ...fakeCriteria,
  targetEntity: "job_offer",
  signalSources: ["france_travail"],
};

describe("discover — company mode", () => {
  it("discovers companies from pappers and tags them with source pappers_search", async () => {
    const result = await discover({
      criteria: criteriaWithPappers,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const companies = result.data as CompanyData[];
    expect(companies).toHaveLength(1);
    expect(companies[0].domain).toBe(fakeCompany.domain);
    expect(companies[0].source).toBe("pappers_search");
  });

  it("discovers companies from job board names and tags them with provider signalSource", async () => {
    const jobBoard = makeMockJobBoardProvider({
      signalSource: "france_travail",
      searchJobs: vi
        .fn()
        .mockResolvedValue({ success: true, data: [fakeJobPosting] }),
    });

    const result = await discover({
      criteria: { ...fakeCriteria, signalSources: ["france_travail"] },
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
      jobBoardProviders: [jobBoard],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const companies = result.data as CompanyData[];
    expect(companies).toHaveLength(1);
    expect(companies[0].source).toBe("france_travail");
  });

  it("discovers companies from brave and tags them with source brave", async () => {
    const result = await discover({
      criteria: criteriaWithBrave,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const companies = result.data as CompanyData[];
    expect(companies).toHaveLength(1);
    expect(companies[0].source).toBe("brave");
  });

  it("deduplicates companies with the same domain", async () => {
    const llm = makeMockLLMProvider({
      extractCompanyNames: vi
        .fn()
        .mockResolvedValue({ success: true, data: ["Acme SAS", "Acme"] }),
    });

    const result = await discover({
      criteria: criteriaWithBrave,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
  });

  it("skips company when Brave returns no usable domain", async () => {
    const search = makeMockSearchProvider({
      search: vi.fn().mockResolvedValue({ success: true, data: [] }),
    });

    const result = await discover({
      criteria: criteriaWithBrave,
      search,
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("returns empty when brave extractCompanyNames returns empty", async () => {
    const llm = makeMockLLMProvider({
      extractCompanyNames: vi
        .fn()
        .mockResolvedValue({ success: true, data: [] }),
    });

    const result = await discover({
      criteria: criteriaWithBrave,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("does not call brave search when brave is not in signalSources", async () => {
    const search = makeMockSearchProvider();

    await discover({
      criteria: criteriaWithPappers,
      search,
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(search.search).not.toHaveBeenCalled();
  });
});

describe("discover — job_offer mode", () => {
  it("returns JobPosting[] from job board providers", async () => {
    const jobBoard = makeMockJobBoardProvider();

    const result = await discover({
      criteria: criteriaJobOffer,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
      jobBoardProviders: [jobBoard],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const postings = result.data as JobPosting[];
    expect(postings).toHaveLength(1);
    expect(postings[0].title).toBe(fakeJobPosting.title);
    expect(postings[0].source).toBe("france_travail");
  });

  it("deduplicates job postings with the same URL", async () => {
    const jobBoard1 = makeMockJobBoardProvider({
      signalSource: "france_travail",
    });
    const jobBoard2 = makeMockJobBoardProvider({ signalSource: "wttj" });

    const result = await discover({
      criteria: {
        ...criteriaJobOffer,
        signalSources: ["france_travail", "wttj"],
      },
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
      jobBoardProviders: [jobBoard1, jobBoard2],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
  });

  it("returns failure when no job board providers are configured", async () => {
    const result = await discover({
      criteria: criteriaJobOffer,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
    });

    expect(result.success).toBe(false);
  });

  it("continues when one job board provider fails", async () => {
    const failingBoard = makeMockJobBoardProvider({
      searchJobs: vi
        .fn()
        .mockResolvedValue({ success: false, error: new Error("API down") }),
    });
    const workingBoard = makeMockJobBoardProvider({ signalSource: "wttj" });

    const result = await discover({
      criteria: criteriaJobOffer,
      search: makeMockSearchProvider(),
      company: makeMockCompanyProvider(),
      llm: makeMockLLMProvider(),
      jobBoardProviders: [failingBoard, workingBoard],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
  });
});
