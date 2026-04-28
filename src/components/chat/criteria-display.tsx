import { Separator } from "@/components/ui/separator";

type CriteriaDisplayProps = {
  rawQuery: string;
};

export function CriteriaDisplay({ rawQuery }: CriteriaDisplayProps) {
  if (!rawQuery) return null;

  return (
    <div className="rounded-md border bg-muted/50 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        Votre recherche
      </p>
      <Separator className="mb-2" />
      <p className="text-sm">{rawQuery}</p>
    </div>
  );
}
