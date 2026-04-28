import { Badge } from "@/components/ui/badge";

export function Pills({ items }: { items: string[] }) {
  if (!items.length)
    return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className="text-xs px-1.5 py-0 font-normal"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}
