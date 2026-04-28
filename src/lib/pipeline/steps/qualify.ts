import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import { buildCompanyUrl } from "@/lib/utils/url";
import type {
  CompanyData,
  QualifiedCompany,
  Result,
  SearchCriteria,
} from "@/types";

type QualifyOptions = {
  companies: CompanyData[];
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: LLMProvider;
};

type QualifyOneOptions = {
  company: CompanyData;
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: LLMProvider;
};

async function qualifyOne({
  company,
  criteria,
  scraper,
  llm,
}: QualifyOneOptions): Promise<Result<QualifiedCompany> | null> {
  const url = buildCompanyUrl({ domain: company.domain });
  const scrapeResult = await scraper.scrape(url);

  // Error level 3 — scrape failed: skip this company, continue with others
  if (!scrapeResult.success) return null;

  const qualifyResult = await llm.qualify({
    company,
    criteria,
    scrapedContent: scrapeResult.data.content,
  });

  if (!qualifyResult.success) return null;

  return {
    success: true,
    data: { ...company, qualification: qualifyResult.data },
  };
}

export async function qualify({
  companies,
  criteria,
  scraper,
  llm,
}: QualifyOptions): Promise<Result<QualifiedCompany[]>> {
  const qualified: QualifiedCompany[] = [];

  for (const company of companies) {
    const result = await qualifyOne({ company, criteria, scraper, llm });
    if (result?.success) qualified.push(result.data);
  }

  return { success: true, data: qualified };
}
