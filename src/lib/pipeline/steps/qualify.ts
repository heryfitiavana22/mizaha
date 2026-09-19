import type { EntityScorerProvider } from "@/lib/providers/interfaces/entity-scorer";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import logger from "@/lib/logger";
import type {
  CompanyData,
  JobPosting,
  QualificationResult,
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

export interface QualifyStrategy<
  TEntity extends CompanyData | JobPosting,
  TQualified,
> {
  prepareContent(
    entity: TEntity,
    scraper: ScraperProvider,
  ): Promise<string | null>;
  finalize(
    entity: TEntity,
    qualification: QualificationResult,
    content: string,
  ): TQualified;
}

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
    `https://${domain}`, // maybe get other pages from "/" or sitemap.xml or robots.txt in the future
    ...PRIORITY_PATHS.map((path) => `https://${domain}${path}`),
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

export const companyQualifyStrategy: QualifyStrategy<
  CompanyData,
  QualifiedCompany
> = {
  prepareContent: async (company, scraper) => {
    const scraped = await scrapeWithFallback({
      domain: company.domain,
      scraper,
    });
    if (!scraped) {
      logger.warn(
        { domain: company.domain },
        "qualify: scrape failed for all pages — skipping company",
      );
    }
    return scraped?.content ?? null;
  },
  finalize: (company, qualification, content) => ({
    ...company,
    qualification,
    scrapedContent: content,
  }),
};

export const jobOfferQualifyStrategy: QualifyStrategy<
  JobPosting,
  QualifiedJobOffer
> = {
  prepareContent: async (posting) => {
    // Job posting description is the content to score — no scraping needed
    return posting.description.trim() || null;
  },
  finalize: (posting, qualification, content) => ({
    ...posting,
    qualification,
    scrapedContent: content,
  }),
};

async function qualifyOne<
  TEntity extends CompanyData | JobPosting,
  TQualified,
>({
  entity,
  criteria,
  scraper,
  llm,
  strategy,
}: {
  entity: TEntity;
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: EntityScorerProvider;
  strategy: QualifyStrategy<TEntity, TQualified>;
}): Promise<TQualified | null> {
  const content = await strategy.prepareContent(entity, scraper);
  if (!content) return null;

  const qualifyResult = await llm.qualify({
    entity,
    criteria,
    scrapedContent: content,
  });
  if (!qualifyResult.success) {
    logger.warn(
      { error: qualifyResult.error.message },
      "qualify: LLM qualification failed — skipping",
    );
    return null;
  }

  logger.info(
    { score: qualifyResult.data.score, reason: qualifyResult.data.reason },
    "qualify: score",
  );

  return strategy.finalize(entity, qualifyResult.data, content);
}

export type CompanyQualifyOptions = {
  entities: CompanyData[];
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: EntityScorerProvider;
  strategy: QualifyStrategy<CompanyData, QualifiedCompany>;
};

export type JobOfferQualifyOptions = {
  entities: JobPosting[];
  criteria: SearchCriteria;
  scraper: ScraperProvider;
  llm: EntityScorerProvider;
  strategy: QualifyStrategy<JobPosting, QualifiedJobOffer>;
};

export async function qualify(
  options: CompanyQualifyOptions,
): Promise<Result<QualifiedCompany[]>>;
export async function qualify(
  options: JobOfferQualifyOptions,
): Promise<Result<QualifiedJobOffer[]>>;
export async function qualify({
  entities,
  criteria,
  scraper,
  llm,
  strategy,
}: CompanyQualifyOptions | JobOfferQualifyOptions): Promise<
  Result<QualifiedCompany[] | QualifiedJobOffer[]>
> {
  const settlements = await Promise.allSettled(
    entities.map((entity) =>
      qualifyOne({
        entity,
        criteria,
        scraper,
        llm,
        strategy: strategy as QualifyStrategy<
          CompanyData | JobPosting,
          QualifiedCompany | QualifiedJobOffer
        >,
      }),
    ),
  );

  const scored = settlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value)
    .filter((r): r is QualifiedCompany | QualifiedJobOffer => r !== null);

  const qualified = scored.filter(
    (item) => item.qualification.score >= SCORE_THRESHOLD,
  );
  return { success: true, data: qualified } as unknown as Result<
    QualifiedCompany[] | QualifiedJobOffer[]
  >;
}
