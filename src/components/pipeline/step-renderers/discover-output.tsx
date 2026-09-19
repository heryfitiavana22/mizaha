import type { CompanyData, JobPosting } from "@/types";

type DiscoveredCompany = CompanyData | JobPosting;

export function DiscoverOutput({ data }: { data: Record<string, unknown> }) {
  const companies: DiscoveredCompany[] = Array.isArray(data)
    ? (data as DiscoveredCompany[])
    : [];

  if (!companies.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise trouvée
      </span>
    );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {companies.length} entreprise{companies.length !== 1 ? "s" : ""}
      </span>
      <div className="flex flex-col gap-1 mt-1">
        {companies.map((company) => {
          const displayName =
            "name" in company ? company.name : company.companyName;
          const displayDomain =
            "domain" in company ? company.domain : company.companyDomain;
          const key =
            "domain" in company
              ? company.domain
              : (company.companyDomain ?? company.url);

          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="font-medium">{displayName}</span>
              {displayDomain && (
                <span className="text-muted-foreground">{displayDomain}</span>
              )}
              {company.source && (
                <span className="text-muted-foreground">
                  · {company.source}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
