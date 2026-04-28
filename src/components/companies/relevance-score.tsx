import { Progress } from "@/components/ui/progress";

type RelevanceScoreProps = {
  score: number;
};

export function RelevanceScore({ score }: RelevanceScoreProps) {
  const percentage = Math.round(score * 100);

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className="text-sm font-semibold tabular-nums">{percentage}%</span>
      <Progress value={percentage} className="w-16 h-1.5" />
    </div>
  );
}
