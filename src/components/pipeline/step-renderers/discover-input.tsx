import { ProviderBadges } from "@/components/pipeline/provider-badges";
import { ExtractCriteriaOutput } from "./extract-criteria-output";

type DiscoverInputData = {
  providers?: {
    search: string;
    searchBackup: string | null;
    company: string;
    companyBackup: string | null;
  };
};

export function DiscoverInput({ data }: { data: Record<string, unknown> }) {
  const input = data as DiscoverInputData;
  return (
    <div className="flex flex-col gap-1.5">
      <ExtractCriteriaOutput data={data} />
      {input.providers && (
        <ProviderBadges
          slots={[
            {
              primary: input.providers.search,
              backup: input.providers.searchBackup ?? undefined,
            },
            {
              primary: input.providers.company,
              backup: input.providers.companyBackup ?? undefined,
            },
          ]}
        />
      )}
    </div>
  );
}
