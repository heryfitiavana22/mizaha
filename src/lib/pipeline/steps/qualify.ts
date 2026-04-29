import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import logger from "@/lib/logger";
import type {
  CompanyData,
  QualifiedCompany,
  Result,
  SearchCriteria,
} from "@/types";

const SCORE_THRESHOLD = 0.5;

// Pages most likely to contain relevant content depending on qualification intent.
// Tried in order before falling back to the homepage.
const PRIORITY_PATHS = [
  "/jobs",
  "/recrutement",
  "/carrieres",
  "/careers",
  "/equipe",
  "/team",
  "/about",
  "/a-propos",
];

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

async function scrapeWithFallback({
  domain,
  scraper,
}: {
  domain: string;
  scraper: ScraperProvider;
}): Promise<{ content: string; url: string } | null> {
  // Try priority pages first, then homepage
  const urlsToTry = [
    ...PRIORITY_PATHS.map((path) => `https://${domain}${path}`),
    `https://${domain}`,
  ];

  for (const url of urlsToTry) {
    const result = await scraper.scrape(url);
    if (result.success && result.data.content.length > 200) {
      return { content: result.data.content, url };
    }
  }

  return null;
}

async function qualifyOne({
  company,
  criteria,
  scraper,
  llm,
}: QualifyOneOptions): Promise<QualifiedCompany | null> {
  const scraped = await scrapeWithFallback({
    domain: company.domain,
    scraper,
  });

  if (!scraped) {
    logger.warn(
      { domain: company.domain },
      "qualify: scrape failed for all pages — skipping company",
    );
    return null;
  }

  const qualifyResult = await llm.qualify({
    company,
    criteria,
    scrapedContent: scraped.content,
  });

  if (!qualifyResult.success) {
    logger.warn(
      { domain: company.domain, error: qualifyResult.error.message },
      "qualify: LLM qualification failed — skipping company",
    );
    return null;
  }

  return {
    ...company,
    qualification: qualifyResult.data,
    scrapedContent: scraped.content,
  };
}

export async function qualify({
  companies,
  criteria,
  scraper,
  llm,
}: QualifyOptions): Promise<Result<QualifiedCompany[]>> {
  const settlements = await Promise.allSettled(
    companies.map((company) => qualifyOne({ company, criteria, scraper, llm })),
  );

  const qualified = settlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value)
    .filter((result): result is QualifiedCompany => result !== null)
    .filter((company) => company.qualification.score >= SCORE_THRESHOLD);

  return { success: true, data: qualified };
}
