import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import { extractDomain } from "@/lib/utils/url";
import type {
  CompanyData,
  Result,
  SearchCriteria,
  SearchResult,
} from "@/types";

const SEARCH_LIMIT_PER_QUERY = 10;

// Domains that are directories, registries, job boards or news sites — not actual companies
const NOISE_DOMAINS = new Set([
  "insee.fr",
  "annuaire-entreprises.data.gouv.fr",
  "data.gouv.fr",
  "entreprises.gouv.fr",
  "infogreffe.fr",
  "bodacc.fr",
  "journal-officiel.gouv.fr",
  "societe.com",
  "verif.com",
  "manageo.fr",
  "pappers.fr",
  "sirene.fr",
  "linkedin.com",
  "welcometothejungle.com",
  "indeed.fr",
  "indeed.com",
  "monster.fr",
  "apec.fr",
  "pole-emploi.fr",
  "francetravail.fr",
  "hellowork.com",
  "choosemycompany.com",
  "glassdoor.fr",
  "wikipedia.org",
  "lefigaro.fr",
  "lemonde.fr",
  "bfmtv.com",
  "latribune.fr",
  "lesechos.fr",
  "capital.fr",
]);

type DiscoverOptions = {
  criteria: SearchCriteria;
  search: SearchProvider;
  company: CompanyProvider;
};

async function runSearchStrategies({
  strategies,
  search,
}: {
  strategies: string[];
  search: SearchProvider;
}): Promise<SearchResult[]> {
  const settlements = await Promise.allSettled(
    strategies.map((query) =>
      search.search({ query, options: { limit: SEARCH_LIMIT_PER_QUERY } }),
    ),
  );

  const results: SearchResult[] = [];
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled" && settlement.value.success) {
      results.push(...settlement.value.data);
    }
  }
  return results;
}

function deduplicateByDomain({
  results,
}: {
  results: SearchResult[];
}): Array<{ result: SearchResult; domain: string }> {
  const seen = new Set<string>();
  const unique: Array<{ result: SearchResult; domain: string }> = [];

  for (const result of results) {
    const domain = extractDomain({ url: result.url });
    if (!domain) continue;
    // SIRENE and Pappers return SIREN numbers as domain — reject pure-digit strings
    if (/^\d+$/.test(domain)) continue;
    if (NOISE_DOMAINS.has(domain)) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    unique.push({ result, domain });
  }

  return unique;
}

async function resolveCompany({
  result,
  domain,
  company,
}: {
  result: SearchResult;
  domain: string;
  company: CompanyProvider;
}): Promise<CompanyData> {
  const companyResult = await company.findByDomain(domain);
  const registryData =
    companyResult.success && companyResult.data ? companyResult.data : null;

  // Always keep the web domain — never let registry SIREN leak as domain
  return {
    name: registryData?.name ?? result.title,
    domain,
    sector: registryData?.sector ?? "",
    location: registryData?.location ?? "",
    employeeCount: registryData?.employeeCount,
    legalForm: registryData?.legalForm,
    foundedAt: registryData?.foundedAt,
  };
}

async function resolveCompanies({
  candidates,
  company,
  maxResults,
}: {
  candidates: Array<{ result: SearchResult; domain: string }>;
  company: CompanyProvider;
  maxResults: number;
}): Promise<CompanyData[]> {
  const toResolve = candidates.slice(0, maxResults);

  const settlements = await Promise.allSettled(
    toResolve.map(({ result, domain }) =>
      resolveCompany({ result, domain, company }),
    ),
  );

  return settlements
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);
}

export async function discover({
  criteria,
  search,
  company,
}: DiscoverOptions): Promise<Result<CompanyData[]>> {
  const maxResults = criteria.maxResults ?? 20;

  const allResults = await runSearchStrategies({
    strategies: criteria.searchStrategies,
    search,
  });

  const candidates = deduplicateByDomain({ results: allResults });

  const companies = await resolveCompanies({
    candidates,
    company,
    maxResults,
  });

  return { success: true, data: companies };
}
