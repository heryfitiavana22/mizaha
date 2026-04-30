import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { JobBoardProvider } from "@/lib/providers/interfaces/job-board";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import logger from "@/lib/logger";
import type {
  CompanyData,
  JobPosting,
  Result,
  SearchCriteria,
  SearchResult,
  SignalSource,
} from "@/types";

const SEARCH_LIMIT_PER_QUERY = 10;
const DEFAULT_MAX_RESULTS = 20;

export type DiscoverOptions = {
  criteria: SearchCriteria;
  jobBoardProviders?: JobBoardProvider[];
  search: SearchProvider;
  company: CompanyProvider;
  llm: LLMProvider;
};

type NamedSource = { name: string; source: SignalSource };

async function runJobBoardSources({
  providers,
  criteria,
}: {
  providers: JobBoardProvider[];
  criteria: SearchCriteria;
}): Promise<JobPosting[]> {
  const jobCriteria = {
    keywords: criteria.techStack,
    location: criteria.location,
  };
  const settlements = await Promise.allSettled(
    providers.map((provider) =>
      provider.searchJobs(jobCriteria).then((result) => ({
        result,
        providerName: provider.name as SignalSource,
      })),
    ),
  );
  const postings: JobPosting[] = [];
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled" && settlement.value.result.success) {
      postings.push(
        ...settlement.value.result.data.map((posting) => ({
          ...posting,
          source: settlement.value.providerName,
        })),
      );
    }
  }
  return postings;
}

async function runPappersSearch({
  criteria,
  company,
}: {
  criteria: SearchCriteria;
  company: CompanyProvider;
}): Promise<CompanyData[]> {
  const result = await company.search({
    sector: criteria.sector,
    location: criteria.location,
    minEmployees: criteria.employeeRange?.min,
    maxEmployees: criteria.employeeRange?.max,
  });
  if (!result.success) {
    logger.warn(
      { error: result.error.message },
      "discover: pappers search failed",
    );
    return [];
  }
  return result.data.map((company) => ({
    ...company,
    source: "pappers_search" as const,
  }));
}

async function runBraveSource({
  criteria,
  search,
  llm,
}: DiscoverOptions): Promise<string[]> {
  const settlements = await Promise.allSettled(
    criteria.searchStrategies.map((query) =>
      search.search({ query, options: { limit: SEARCH_LIMIT_PER_QUERY } }),
    ),
  );
  const results: SearchResult[] = [];
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled" && settlement.value.success) {
      results.push(...settlement.value.data);
    }
  }
  if (results.length === 0) return [];

  const extracted = await llm.extractCompanyNames(results);
  if (!extracted.success) {
    logger.warn(
      { error: extracted.error.message },
      "discover: extractCompanyNames failed",
    );
    return [];
  }
  return extracted.data;
}

async function resolveNamesToCompanies({
  namedSources,
  company,
}: {
  namedSources: NamedSource[];
  company: CompanyProvider;
}): Promise<CompanyData[]> {
  const uniqueByName = [
    ...new Map(namedSources.map((ns) => [ns.name, ns])).values(),
  ];
  const settlements = await Promise.allSettled(
    uniqueByName.map(({ name, source }) =>
      company.findByName(name).then((result) => ({ result, source })),
    ),
  );
  const companies: CompanyData[] = [];
  for (const settlement of settlements) {
    if (
      settlement.status === "fulfilled" &&
      settlement.value.result.success &&
      settlement.value.result.data !== null
    ) {
      companies.push({
        ...settlement.value.result.data,
        source: settlement.value.source,
      });
    }
  }
  return companies;
}

function deduplicateByDomain({
  companies,
}: {
  companies: CompanyData[];
}): CompanyData[] {
  const seen = new Set<string>();
  return companies.filter((company) => {
    if (seen.has(company.domain)) return false;
    seen.add(company.domain);
    return true;
  });
}

function deduplicateByUrl({
  postings,
}: {
  postings: JobPosting[];
}): JobPosting[] {
  const seen = new Set<string>();
  return postings.filter((posting) => {
    if (seen.has(posting.url)) return false;
    seen.add(posting.url);
    return true;
  });
}

function deduplicateNamedSources(sources: NamedSource[]): NamedSource[] {
  return [...new Map(sources.map((ns) => [ns.name, ns])).values()];
}

async function collectSignalSources(options: DiscoverOptions): Promise<{
  pappersCompanies: CompanyData[];
  namedSources: NamedSource[];
}> {
  const { criteria, jobBoardProviders, company } = options;

  const hasJobBoardSignal = criteria.signalSources.some(
    (source) => source === "france_travail" || source === "wttj",
  );

  const pappersPromise = criteria.signalSources.includes("pappers_search")
    ? runPappersSearch({ criteria, company })
    : Promise.resolve([] as CompanyData[]);

  const jobBoardPromise =
    hasJobBoardSignal && jobBoardProviders?.length
      ? runJobBoardSources({ providers: jobBoardProviders, criteria }).then(
          (postings) =>
            postings.map((posting) => ({
              name: posting.companyName,
              source: posting.source ?? ("france_travail" as const),
            })),
        )
      : Promise.resolve([] as NamedSource[]);

  const bravePromise = criteria.signalSources.includes("brave")
    ? runBraveSource(options).then((names) =>
        names.map((name) => ({ name, source: "brave" as const })),
      )
    : Promise.resolve([] as NamedSource[]);

  const [pappersCompanies, jobBoardNamed, braveNamed] = await Promise.all([
    pappersPromise,
    jobBoardPromise,
    bravePromise,
  ]);

  return {
    pappersCompanies,
    namedSources: deduplicateNamedSources([...jobBoardNamed, ...braveNamed]),
  };
}

async function discoverCompanies(
  options: DiscoverOptions,
): Promise<Result<CompanyData[]>> {
  const { criteria, company } = options;

  const { pappersCompanies, namedSources } =
    await collectSignalSources(options);
  const resolvedCompanies = await resolveNamesToCompanies({
    namedSources,
    company,
  });

  const maxResults = criteria.maxResults ?? DEFAULT_MAX_RESULTS;
  const deduplicated = deduplicateByDomain({
    companies: [...pappersCompanies, ...resolvedCompanies],
  }).slice(0, maxResults);

  logger.info({ count: deduplicated.length }, "discover: companies collected");
  return { success: true, data: deduplicated };
}

async function discoverJobOffers({
  criteria,
  jobBoardProviders,
}: DiscoverOptions): Promise<Result<JobPosting[]>> {
  if (!jobBoardProviders?.length) {
    return {
      success: false,
      error: new Error(
        "No job board providers configured for job_offer discovery",
      ),
    };
  }

  const postings = await runJobBoardSources({
    providers: jobBoardProviders,
    criteria,
  });
  const deduplicated = deduplicateByUrl({ postings });

  logger.info({ count: deduplicated.length }, "discover: job offers collected");
  return { success: true, data: deduplicated };
}

export async function discover(
  options: DiscoverOptions,
): Promise<Result<CompanyData[] | JobPosting[]>> {
  if (options.criteria.targetEntity === "job_offer") {
    return discoverJobOffers(options);
  }
  return discoverCompanies(options);
}
