import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import logger from "@/lib/logger";
import { extractDomain } from "@/lib/utils/url";
import type {
  CompanyData,
  Result,
  SearchCriteria,
  SearchResult,
} from "@/types";

const SEARCH_LIMIT_PER_QUERY = 10;

// Fetch more candidates than needed — some names may fail to resolve or map to the same domain
const DOMAIN_RESOLUTION_BUFFER = 2;

// Excluded from domain resolution queries — high-traffic platforms rank above the company's own site
const DOMAIN_RESOLUTION_EXCLUSIONS =
  "-site:linkedin.com -site:reddit.com -site:indeed.com -site:indeed.fr -site:welcometothejungle.com -site:jobteaser.com";

// Platforms and aggregators — never a B2B prospect for any use case (UC1, UC2, UC3...)
// Covers subdomains: de.linkedin.com, jp.linkedin.com, etc.
const PLATFORM_DOMAINS = new Set([
  // Social & community
  "linkedin.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "github.com",
  // Job boards
  "welcometothejungle.com",
  "indeed.com",
  "indeed.fr",
  "jobteaser.com",
  "monster.fr",
  "apec.fr",
  "francetravail.fr",
  "pole-emploi.fr",
  "glassdoor.com",
  "hellowork.com",
  // Reference & encyclopedias
  "wikipedia.org",
  "wikidata.org",
  "crunchbase.com",
  // Company registries (data sources, not prospects)
  "societe.com",
  "verif.com",
  "infogreffe.fr",
  "annuaire-entreprises.data.gouv.fr",
]);

function isPlatformDomain(domain: string): boolean {
  return (
    PLATFORM_DOMAINS.has(domain) ||
    [...PLATFORM_DOMAINS].some((p) => domain.endsWith(`.${p}`))
  );
}

type DiscoverOptions = {
  criteria: SearchCriteria;
  search: SearchProvider;
  company: CompanyProvider;
  llm: LLMProvider;
};

async function runSearchStrategies({
  strategies,
  search,
}: {
  strategies: string[];
  search: SearchProvider;
}): Promise<{ results: SearchResult[]; allFailed: boolean }> {
  const settlements = await Promise.allSettled(
    strategies.map((query) =>
      search.search({ query, options: { limit: SEARCH_LIMIT_PER_QUERY } }),
    ),
  );

  const results: SearchResult[] = [];
  let successCount = 0;
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled" && settlement.value.success) {
      successCount++;
      results.push(...settlement.value.data);
    }
  }

  return {
    results,
    allFailed: successCount === 0 && strategies.length > 0,
  };
}

async function resolveCompanyDomain({
  name,
  search,
}: {
  name: string;
  search: SearchProvider;
}): Promise<string | null> {
  const result = await search.search({
    query: `"${name}" ${DOMAIN_RESOLUTION_EXCLUSIONS}`,
    options: { limit: 5 },
  });
  if (!result.success || result.data.length === 0) return null;

  for (const item of result.data) {
    const domain = extractDomain({ url: item.url });
    if (domain && !isPlatformDomain(domain)) return domain;
  }
  return null;
}

function collectUniqueDomains({
  settlements,
}: {
  settlements: PromiseSettledResult<string | null>[];
}): string[] {
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled" && settlement.value) {
      const domain = settlement.value;
      if (!seen.has(domain)) {
        seen.add(domain);
        domains.push(domain);
      }
    }
  }
  return domains;
}

async function resolveCompany({
  domain,
  company,
}: {
  domain: string;
  company: CompanyProvider;
}): Promise<CompanyData> {
  const companyResult = await company.findByDomain(domain);
  const registryData =
    companyResult.success && companyResult.data ? companyResult.data : null;

  return {
    name: registryData?.name ?? domain,
    domain,
    sector: registryData?.sector ?? "",
    location: registryData?.location ?? "",
    employeeCount: registryData?.employeeCount,
    legalForm: registryData?.legalForm,
    foundedAt: registryData?.foundedAt,
  };
}

export async function discover({
  criteria,
  search,
  company,
  llm,
}: DiscoverOptions): Promise<Result<CompanyData[]>> {
  const maxResults = criteria.maxResults ?? 20;

  const { results: allResults, allFailed } = await runSearchStrategies({
    strategies: criteria.searchStrategies,
    search,
  });

  if (allFailed) {
    return { success: false, error: new Error("All search strategies failed") };
  }

  if (allResults.length === 0) {
    return { success: true, data: [] };
  }

  const extractResult = await llm.extractCompanies(allResults);
  if (!extractResult.success) {
    logger.warn(
      { error: extractResult.error.message },
      "discover: extractCompanies failed — returning empty",
    );
    return { success: true, data: [] };
  }

  const uniqueNames = [...new Set(extractResult.data)];
  logger.info({ names: uniqueNames }, "discover: extracted company names");
  if (uniqueNames.length === 0) {
    return { success: true, data: [] };
  }

  const domainSettlements = await Promise.allSettled(
    uniqueNames
      .slice(0, maxResults * DOMAIN_RESOLUTION_BUFFER)
      .map((name) => resolveCompanyDomain({ name, search })),
  );

  const domains = collectUniqueDomains({
    settlements: domainSettlements,
  }).filter((d) => !isPlatformDomain(d));
  if (domains.length === 0) {
    return { success: true, data: [] };
  }

  const companySettlements = await Promise.allSettled(
    domains
      .slice(0, maxResults)
      .map((domain) => resolveCompany({ domain, company })),
  );

  const companies = companySettlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);

  return { success: true, data: companies };
}
