import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RelevanceScore } from "./relevance-score";
import { ContactInfo } from "./contact-info";

type Contact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedinUrl: string | null;
};

export type CompanyResult = {
  type: "company";
  companyId: string;
  name: string;
  domain: string;
  sector: string | null;
  location: string | null;
  employeeCount: number | null;
  techStack: unknown;
  relevanceScore: number;
  relevanceReason: string;
  contacts: Contact[];
};

type CompanyCardProps = {
  company: CompanyResult;
};

export function CompanyCard({ company }: CompanyCardProps) {
  const techStack = Array.isArray(company.techStack) ? company.techStack : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate">{company.name}</CardTitle>
            <CardDescription>{company.domain}</CardDescription>
          </div>
          <RelevanceScore score={company.relevanceScore} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {company.sector && (
            <Badge variant="secondary">{company.sector}</Badge>
          )}
          {company.location && (
            <Badge variant="outline">{company.location}</Badge>
          )}
          {company.employeeCount != null && (
            <Badge variant="outline">{company.employeeCount} employés</Badge>
          )}
          {techStack.map((tech) => (
            <Badge key={String(tech)} variant="outline">
              {String(tech)}
            </Badge>
          ))}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {company.relevanceReason}
        </p>

        {company.contacts.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {company.contacts.map((contact) => (
                <ContactInfo key={contact.id} contact={contact} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
