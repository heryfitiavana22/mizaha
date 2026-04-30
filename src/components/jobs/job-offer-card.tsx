import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RelevanceScore } from "@/components/companies/relevance-score";

export type JobOfferResult = {
  type: "job_offer";
  entityId: string;
  title: string;
  companyName: string;
  url: string;
  contractType: string;
  location: string;
  techStack: string[];
  description: string;
  postedAt: string | null;
  relevanceScore: number;
  relevanceReason: string;
};

type JobOfferCardProps = {
  offer: JobOfferResult;
};

export function JobOfferCard({ offer }: JobOfferCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate">
              <a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {offer.title}
              </a>
            </CardTitle>
            <CardDescription>{offer.companyName}</CardDescription>
          </div>
          <RelevanceScore score={offer.relevanceScore} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {offer.location && <Badge variant="outline">{offer.location}</Badge>}
          {offer.contractType && (
            <Badge variant="secondary">{offer.contractType}</Badge>
          )}
          {offer.techStack.map((tech) => (
            <Badge key={tech} variant="outline">
              {tech}
            </Badge>
          ))}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {offer.relevanceReason}
        </p>
      </CardContent>
    </Card>
  );
}
