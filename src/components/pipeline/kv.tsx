export function KV({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
}
