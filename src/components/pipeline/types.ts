export type StepStatus = "running" | "completed" | "failed";

export type PipelineRun = {
  id: string;
  step: string;
  status: StepStatus;
  error: string | null;
  durationMs: number | null;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  createdAt: string | null;
};

export type ProviderSlot = {
  primary: string;
  backup?: string | null;
  usedFallback?: boolean;
};

export const STEP_ORDER = [
  "extract-criteria",
  "discover",
  "qualify",
  "enrich",
] as const;

export const STEP_META: Record<
  string,
  { label: string; inputLabel: string; outputLabel: string }
> = {
  "extract-criteria": {
    label: "Extraction des critères",
    inputLabel: "Requête brute",
    outputLabel: "Critères extraits",
  },
  discover: {
    label: "Découverte d'entreprises",
    inputLabel: "Critères de recherche",
    outputLabel: "Entreprises trouvées",
  },
  qualify: {
    label: "Qualification",
    inputLabel: "Entreprises candidates",
    outputLabel: "Entreprises qualifiées",
  },
  enrich: {
    label: "Enrichissement",
    inputLabel: "Entreprises qualifiées",
    outputLabel: "Résultat final",
  },
};
