import { Badge } from "@/components/ui/badge";

type QualifiedCompany = {
  name: string;
  domain: string;
  qualification: {
    score: number;
    reason: string;
    matchedCriteria?: string[];
  };
};

export function QualifyOutput({ data }: { data: Record<string, unknown> }) {
  const companies: QualifiedCompany[] = Array.isArray(data)
    ? (data as QualifiedCompany[])
    : [];

  if (!companies.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise qualifiée
      </span>
    );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">
        {companies.length} retenue{companies.length !== 1 ? "s" : ""}
      </span>
      {companies.map((company) => {
        const score = company.qualification?.score ?? 0;
        return (
          <div
            key={company.domain}
            className="flex flex-col gap-0.5 border-l-2 border-border pl-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{company.name}</span>
              <span className="text-xs text-muted-foreground">
                {company.domain}
              </span>
              <Badge
                variant={score >= 0.7 ? "default" : "secondary"}
                className="text-xs px-1.5 py-0 ml-auto"
              >
                {Math.round(score * 100)}%
              </Badge>
            </div>
            {company.qualification?.reason && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {company.qualification.reason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
