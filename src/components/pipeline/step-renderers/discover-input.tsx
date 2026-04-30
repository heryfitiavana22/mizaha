import { Pills } from "@/components/pipeline/pills";

export function DiscoverInput({ data }: { data: Record<string, unknown> }) {
  const signalSources = Array.isArray(data.signalSources)
    ? (data.signalSources as string[])
    : [];
  const targetEntity =
    typeof data.targetEntity === "string" ? data.targetEntity : null;

  return (
    <div className="flex flex-col gap-1.5">
      {targetEntity && (
        <span className="text-xs text-muted-foreground">
          Cible :{" "}
          <span className="font-medium text-foreground">{targetEntity}</span>
        </span>
      )}
      {signalSources.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Sources</span>
          <Pills items={signalSources} />
        </div>
      )}
    </div>
  );
}
