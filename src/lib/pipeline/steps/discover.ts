import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import { extractDomain } from "@/lib/utils/url";
import type {
  CompanyData,
  Result,
  SearchCriteria,
  SearchResult,
} from "@/types";

type DiscoverOptions = {
  criteria: SearchCriteria;
  search: SearchProvider;
  company: CompanyProvider;
};

function buildSearchQuery({ criteria }: { criteria: SearchCriteria }): string {
  const parts: string[] = [];
  if (criteria.sector) parts.push(criteria.sector);
  if (criteria.location) parts.push(criteria.location);
  else parts.push("France");
  if (criteria.techStack?.length) parts.push(criteria.techStack.join(" "));
  parts.push("entreprise");
  return parts.join(" ");
}

async function resolveCompanies({
  results,
  company,
}: {
  results: SearchResult[];
  company: CompanyProvider;
}): Promise<CompanyData[]> {
  const seen = new Set<string>();
  const toResolve: Array<{ result: SearchResult; domain: string }> = [];

  for (const result of results) {
    const domain = extractDomain({ url: result.url });
    // Skip missing, already-seen, or pure-digit strings (SIREN codes, not domains)
    if (!domain || /^\d+$/.test(domain) || seen.has(domain)) continue;
    seen.add(domain);
    toResolve.push({ result, domain });
  }

  const settlements = await Promise.allSettled(
    toResolve.map(async ({ result, domain }) => {
      const companyResult = await company.findByDomain(domain);
      if (companyResult.success && companyResult.data)
        return companyResult.data;
      // Company provider found nothing — keep minimal data so qualify can scrape
      return {
        name: result.title,
        domain,
        sector: "",
        location: "",
      } as CompanyData;
    }),
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
  const query = buildSearchQuery({ criteria });
  const searchResult = await search.search({ query });

  if (!searchResult.success) return searchResult;

  const companies = await resolveCompanies({
    results: searchResult.data,
    company,
  });

  return { success: true, data: companies };
}
