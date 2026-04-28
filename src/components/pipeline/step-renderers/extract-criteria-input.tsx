import { KV } from "@/components/pipeline/kv";
import { ProviderBadges } from "@/components/pipeline/provider-badges";

type ExtractCriteriaInputData = {
  rawQuery: string;
  useCase: string;
  uiCriteria: Record<string, unknown>;
  providers?: { llm: string };
};

export function ExtractCriteriaInput({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const input = data as ExtractCriteriaInputData;
  return (
    <div className="flex flex-col gap-1.5">
      <KV label="Requête" value={input.rawQuery} />
      <KV label="Cas d'usage" value={input.useCase} />
      {input.uiCriteria && Object.keys(input.uiCriteria).length > 0 && (
        <KV label="Critères UI" value={JSON.stringify(input.uiCriteria)} />
      )}
      {input.providers && (
        <ProviderBadges slots={[{ primary: input.providers.llm }]} />
      )}
    </div>
  );
}
