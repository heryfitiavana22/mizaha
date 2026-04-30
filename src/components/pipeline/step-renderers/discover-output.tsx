type DiscoveredCompany = {
  name: string;
  domain: string;
  location?: string;
  source?: string;
};

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
        {companies.map((company) => (
          <div key={company.domain} className="flex items-center gap-2 text-xs">
            <span className="font-medium">{company.name}</span>
            <span className="text-muted-foreground">{company.domain}</span>
            {company.source && (
              <span className="text-muted-foreground">· {company.source}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
