export function QualifyInput({ data }: { data: Record<string, unknown> }) {
  const count = typeof data.entityCount === "number" ? data.entityCount : 0;
  if (!count)
    return (
      <span className="text-xs text-muted-foreground">
        Aucune entreprise en entrée
      </span>
    );
  return (
    <span className="text-xs text-muted-foreground">
      {count} entreprise{count !== 1 ? "s" : ""} à qualifier
    </span>
  );
}
