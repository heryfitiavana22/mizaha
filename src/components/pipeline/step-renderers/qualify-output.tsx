import { Badge } from "@/components/ui/badge";
import { Pills } from "@/components/pipeline/pills";

type QualifyOutputData = {
  count: number;
  companies: {
    name: string;
    domain: string;
    score: number;
    reason: string;
    matchedSignals: string[];
  }[];
};

export function QualifyOutput({ data }: { data: Record<string, unknown> }) {
  const output = data as QualifyOutputData;
  if (!output.companies?.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise qualifiée
      </span>
    );
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">
        {output.count} retenue{output.count !== 1 ? "s" : ""}
      </span>
      {output.companies.map((company) => (
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
              variant={company.score >= 0.7 ? "default" : "secondary"}
              className="text-xs px-1.5 py-0 ml-auto"
            >
              {Math.round(company.score * 100)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{company.reason}</p>
          {company.matchedSignals?.length > 0 && (
            <Pills items={company.matchedSignals} />
          )}
        </div>
      ))}
    </div>
  );
}
