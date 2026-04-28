import { Badge } from "@/components/ui/badge";
import { ProviderBadges } from "@/components/pipeline/provider-badges";

type EnrichInputData = {
  count: number;
  companies: { name: string; domain: string; score: number }[];
  providers?: { email: string };
};

export function EnrichInput({ data }: { data: Record<string, unknown> }) {
  const input = data as EnrichInputData;
  if (!input.companies?.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise en entrée
      </span>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">
        {input.count} entreprise{input.count !== 1 ? "s" : ""} à enrichir
      </span>
      <div className="flex flex-wrap gap-1">
        {input.companies.map((company) => (
          <Badge
            key={company.domain}
            variant="secondary"
            className="text-xs font-normal"
          >
            {company.name}
            <span className="ml-1 text-muted-foreground">
              {Math.round(company.score * 100)}%
            </span>
          </Badge>
        ))}
      </div>
      {input.providers && (
        <ProviderBadges slots={[{ primary: input.providers.email }]} />
      )}
    </div>
  );
}
