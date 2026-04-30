import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import logger from "@/lib/logger";
import type {
  CompanyData,
  JobPosting,
  QualifiedCompany,
  QualifiedJobOffer,
  Result,
  SearchCriteria,
} from "@/types";

const SCORE_THRESHOLD = 0.5;

// Tried in order — priority pages are more likely to contain qualifying signals than the homepage.
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

export type QualifyOptions = {
  entities: CompanyData[] | JobPosting[];
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: LLMProvider;
};

type QualifyOneCompanyOptions = {
  company: CompanyData;
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: LLMProvider;
};

function looksLikeErrorPage(content: string): boolean {
  const header = content.slice(0, 400).toLowerCase();
  return (
    header.includes("404") ||
    header.includes("page not found") ||
    header.includes("page introuvable") ||
    header.includes("page non trouv") ||
    header.includes("n'existe pas") ||
    header.includes("does not exist")
  );
}

async function scrapeWithFallback({
  domain,
  scraper,
}: {
  domain: string;
  scraper: ScraperProvider;
}): Promise<{ content: string; url: string } | null> {
  const urlsToTry = [
    ...PRIORITY_PATHS.map((path) => `https://${domain}${path}`),
    `https://${domain}`,
  ];

  for (const url of urlsToTry) {
    const result = await scraper.scrape(url);
    if (
      result.success &&
      result.data.content.length > 200 &&
      !looksLikeErrorPage(result.data.content)
    ) {
      return { content: result.data.content, url };
    }
  }
  return null;
}

async function qualifyOneCompany({
  company,
  criteria,
  scraper,
  llm,
}: QualifyOneCompanyOptions): Promise<QualifiedCompany | null> {
  const scraped = await scrapeWithFallback({ domain: company.domain, scraper });

  if (!scraped) {
    logger.warn(
      { domain: company.domain },
      "qualify: scrape failed for all pages — skipping company",
    );
    return null;
  }

  const qualifyResult = await llm.qualify({
    entity: company,
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

async function qualifyOneJobOffer({
  posting,
  criteria,
  llm,
}: {
  posting: JobPosting;
  criteria: SearchCriteria;
  llm: LLMProvider;
}): Promise<QualifiedJobOffer | null> {
  const qualifyResult = await llm.qualify({
    entity: posting,
    criteria,
    // Job posting description is the content to score — no scraping needed
    scrapedContent: posting.description,
  });

  if (!qualifyResult.success) {
    logger.warn(
      { url: posting.url, error: qualifyResult.error.message },
      "qualify: LLM qualification failed — skipping job offer",
    );
    return null;
  }

  return {
    ...posting,
    qualification: qualifyResult.data,
    scrapedContent: posting.description,
  };
}

async function qualifyCompanies({
  companies,
  criteria,
  scraper,
  llm,
}: {
  companies: CompanyData[];
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: LLMProvider;
}): Promise<Result<QualifiedCompany[]>> {
  const settlements = await Promise.allSettled(
    companies.map((company) =>
      qualifyOneCompany({ company, criteria, scraper, llm }),
    ),
  );
  const scored = settlements
    .filter((settlement) => settlement.status === "fulfilled")
    .map((settlement) => settlement.value)
    .filter((result): result is QualifiedCompany => result !== null);

  for (const c of scored) {
    logger.info(
      {
        domain: c.domain,
        score: c.qualification.score,
        reason: c.qualification.reason,
      },
      "qualify: score",
    );
  }

  const qualified = scored.filter(
    (c) => c.qualification.score >= SCORE_THRESHOLD,
  );
  return { success: true, data: qualified };
}

async function qualifyJobOffers({
  postings,
  criteria,
  llm,
}: {
  postings: JobPosting[];
  criteria: SearchCriteria;
  llm: LLMProvider;
}): Promise<Result<QualifiedJobOffer[]>> {
  const settlements = await Promise.allSettled(
    postings.map((posting) => qualifyOneJobOffer({ posting, criteria, llm })),
  );
  const qualified = settlements
    .filter((settlement) => settlement.status === "fulfilled")
    .map((settlement) => settlement.value)
    .filter((result): result is QualifiedJobOffer => result !== null)
    .filter((offer) => offer.qualification.score >= SCORE_THRESHOLD);
  return { success: true, data: qualified };
}

export async function qualify({
  entities,
  criteria,
  scraper,
  llm,
}: QualifyOptions): Promise<Result<QualifiedCompany[] | QualifiedJobOffer[]>> {
  if (criteria.targetEntity === "job_offer") {
    return qualifyJobOffers({
      postings: entities as JobPosting[],
      criteria,
      llm,
    });
  }
  return qualifyCompanies({
    companies: entities as CompanyData[],
    criteria,
    scraper,
    llm,
  });
}
