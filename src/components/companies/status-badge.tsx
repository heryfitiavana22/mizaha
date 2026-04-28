import { Badge } from "@/components/ui/badge";

type SearchStatus = "pending" | "running" | "completed" | "failed";

const STATUS_LABEL: Record<SearchStatus, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Échec",
};

const STATUS_VARIANT: Record<
  SearchStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

type StatusBadgeProps = {
  status: SearchStatus | null;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return null;
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
