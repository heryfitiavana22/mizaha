import { Badge } from "@/components/ui/badge";

type DiscoverOutputData = {
  count: number;
  usedSearchFallback?: boolean;
  companies: {
    name: string;
    domain: string;
    location: string;
    employeeCount: number | null;
  }[];
};

export function DiscoverOutput({ data }: { data: Record<string, unknown> }) {
  const output = data as DiscoverOutputData;
  if (!output.companies?.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise trouvée
      </span>
    );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {output.count} entreprise{output.count !== 1 ? "s" : ""}
        </span>
        {output.usedSearchFallback && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0">
            ⚡ fallback search utilisé
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1 mt-1">
        {output.companies.map((company) => (
          <div key={company.domain} className="flex items-center gap-2 text-xs">
            <span className="font-medium">{company.name}</span>
            <span className="text-muted-foreground">{company.domain}</span>
            {company.location && (
              <span className="text-muted-foreground">
                · {company.location}
              </span>
            )}
            {company.employeeCount && (
              <span className="text-muted-foreground">
                · {company.employeeCount} emp.
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
