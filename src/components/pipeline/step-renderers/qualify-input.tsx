import { Badge } from "@/components/ui/badge";
import { ProviderBadges } from "@/components/pipeline/provider-badges";

type QualifyInputData = {
  count: number;
  companies: { name: string; domain: string }[];
  providers?: { scraper: string; scraperBackup: string | null; llm: string };
};

export function QualifyInput({ data }: { data: Record<string, unknown> }) {
  const input = data as QualifyInputData;
  if (!input.companies?.length)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise en entrée
      </span>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">
        {input.count} entreprise{input.count !== 1 ? "s" : ""} à qualifier
      </span>
      <div className="flex flex-wrap gap-1">
        {input.companies.map((company) => (
          <Badge
            key={company.domain}
            variant="secondary"
            className="text-xs font-normal"
          >
            {company.name}
          </Badge>
        ))}
      </div>
      {input.providers && (
        <ProviderBadges
          slots={[
            {
              primary: input.providers.scraper,
              backup: input.providers.scraperBackup ?? undefined,
            },
            { primary: input.providers.llm },
          ]}
        />
      )}
    </div>
  );
}
