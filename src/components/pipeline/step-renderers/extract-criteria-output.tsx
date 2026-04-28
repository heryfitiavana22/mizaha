import { KV } from "@/components/pipeline/kv";
import { Pills } from "@/components/pipeline/pills";

type ExtractCriteriaOutputData = {
  sector?: string;
  location?: string;
  signals?: string[];
  techStack?: string[];
  employeeRange?: { min: number; max: number };
};

export function ExtractCriteriaOutput({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const output = data as ExtractCriteriaOutputData;
  return (
    <div className="flex flex-col gap-1.5">
      {output.sector && <KV label="Secteur" value={output.sector} />}
      {output.location && <KV label="Localisation" value={output.location} />}
      {output.signals && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Signaux</span>
          <Pills items={output.signals} />
        </div>
      )}
      {output.techStack && output.techStack.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Stack technique</span>
          <Pills items={output.techStack} />
        </div>
      )}
      {output.employeeRange && (
        <KV
          label="Taille"
          value={`${output.employeeRange.min} – ${output.employeeRange.max} employés`}
        />
      )}
    </div>
  );
}
