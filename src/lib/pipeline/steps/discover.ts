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
const RESOLVE_BATCH_SIZE = 5;

const KNOWN_AGGREGATOR_DOMAINS = new Set([
  "linkedin.com",
  "indeed.fr",
  "indeed.com",
  "welcometothejungle.com",
  "glassdoor.fr",
  "glassdoor.com",
  "monster.fr",
  "monster.com",
  "cadremploi.fr",
  "hellowork.com",
  "pole-emploi.fr",
  "francetravail.fr",
  "apec.fr",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "wikipedia.org",
  "societe.com",
  "verif.com",
  "pappers.fr",
  "infogreffe.fr",
  "apple.com",
  "apps.apple.com",
  "play.google.com",
  "lefigaro.fr",
  "lemonde.fr",
  "lesechos.fr",
  "pagesjaunes.fr",
  "theorg.com",
  "crunchbase.com",
  "societeinfo.com",
]);

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
        signalSource: provider.signalSource,
      })),
    ),
  );
  const postings: JobPosting[] = [];
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled" && settlement.value.result.success) {
      postings.push(
        ...settlement.value.result.data.map((posting) => ({
          ...posting,
          source: settlement.value.signalSource,
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

const DEV_SUBDOMAINS =
  /^(dev|staging|preprod|test|sandbox|app|api|admin|beta|demo|preview)\./;

function extractDomainFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
      .replace(/^www\./, "")
      .replace(DEV_SUBDOMAINS, "");
    if (KNOWN_AGGREGATOR_DOMAINS.has(hostname)) return null;
    // Subdomain match (en.wikipedia.org → wikipedia.org)
    for (const agg of KNOWN_AGGREGATOR_DOMAINS) {
      if (hostname.endsWith(`.${agg}`)) return null;
    }
    // Government sites are not French startups
    if (hostname.endsWith(".gouv.fr") || hostname === "gouv.fr") return null;
    return hostname;
  } catch {
    return null;
  }
}

function nameMatchesResult(
  name: string,
  item: { title: string; snippet: string },
): boolean {
  // Require at least one significant word from the company name to appear in title or snippet
  const words = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3); // skip short words like "SAS", "FMS", "AK"
  if (words.length === 0) return true; // very short name — can't validate, accept
  const haystack = `${item.title} ${item.snippet}`.toLowerCase();
  return words.some((w) => haystack.includes(w));
}

async function resolveDomainForName({
  name,
  search,
}: {
  name: string;
  search: SearchProvider;
}): Promise<string | null> {
  const result = await search.search({
    query: `"${name}" site officiel`,
    options: { limit: 5 },
  });
  if (!result.success) return null;
  for (const item of result.data) {
    const domain = extractDomainFromUrl(item.url);
    if (domain && nameMatchesResult(name, item)) return domain;
  }
  return null;
}

async function batchedMap<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function resolveNamesToCompanies({
  namedSources,
  search,
}: {
  namedSources: NamedSource[];
  search: SearchProvider;
}): Promise<CompanyData[]> {
  const uniqueByName = [
    ...new Map(namedSources.map((ns) => [ns.name, ns])).values(),
  ];
  const resolved = await batchedMap<NamedSource, CompanyData | null>(
    uniqueByName,
    RESOLVE_BATCH_SIZE,
    async ({ name, source }) => {
      const domain = await resolveDomainForName({ name, search });
      if (!domain) return null;
      return { name, domain, sector: "", location: "", source };
    },
  );
  return resolved.filter((c): c is CompanyData => c !== null);
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
  const { criteria, search } = options;

  const { pappersCompanies, namedSources } =
    await collectSignalSources(options);
  const resolvedCompanies = await resolveNamesToCompanies({
    namedSources,
    search,
  });

  const maxResults = criteria.maxResults ?? DEFAULT_MAX_RESULTS;
  // SIRENE returns SIREN numbers (9 digits) as domain — skip them, no real URL
  const validPappers = pappersCompanies.filter((c) => !/^\d+$/.test(c.domain));
  const deduplicated = deduplicateByDomain({
    companies: [...validPappers, ...resolvedCompanies],
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
