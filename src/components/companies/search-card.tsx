import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SearchStatus = "pending" | "running" | "completed" | "failed";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Échec",
};

export type SearchRow = {
  id: string;
  rawQuery: string;
  useCase: string | null;
  status: string | null;
  createdAt: string | null;
};

type SearchCardProps = {
  search: SearchRow;
};

export function SearchCard({ search }: SearchCardProps) {
  const status = (search.status ?? "pending") as SearchStatus;
  const date = search.createdAt
    ? new Date(search.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Link href={`/searches/${search.id}`} className="block">
      <Card className="hover:shadow-sm transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-base font-medium truncate">
              {search.rawQuery}
            </CardTitle>
            <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
          </div>
          {(search.useCase ?? date) && (
            <CardDescription className="flex gap-2 text-xs">
              {search.useCase && <span>{search.useCase}</span>}
              {date && <span>{date}</span>}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent />
      </Card>
    </Link>
  );
}
