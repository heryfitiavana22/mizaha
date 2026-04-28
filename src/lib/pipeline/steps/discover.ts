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
  const resolved: CompanyData[] = [];

  for (const result of results) {
    const domain = extractDomain({ url: result.url });
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);

    const companyResult = await company.findByDomain(domain);
    if (companyResult.success && companyResult.data) {
      resolved.push(companyResult.data);
    } else {
      // Company provider found nothing — keep the domain with minimal data
      // so qualify can scrape the site and fill in the context
      resolved.push({ name: result.title, domain, sector: "", location: "" });
    }
  }

  return resolved;
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
