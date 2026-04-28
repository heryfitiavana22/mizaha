import { INPUT_RENDERERS, OUTPUT_RENDERERS } from "./step-renderers";

type DataSectionProps = {
  label: string;
  data: Record<string, unknown> | null;
  step: string;
  kind: "input" | "output";
};

export function DataSection({ label, data, step, kind }: DataSectionProps) {
  const Renderer =
    kind === "input" ? INPUT_RENDERERS[step] : OUTPUT_RENDERERS[step];
  if (!data || !Renderer) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Renderer data={data} />
    </div>
  );
}
