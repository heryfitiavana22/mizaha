import { CompanyCard, type CompanyResult } from "./company-card";

type CompanyListProps = {
  companies: CompanyResult[];
};

export function CompanyList({ companies }: CompanyListProps) {
  if (companies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune entreprise trouvée.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {companies.map((company) => (
        <CompanyCard key={company.companyId} company={company} />
      ))}
    </div>
  );
}
