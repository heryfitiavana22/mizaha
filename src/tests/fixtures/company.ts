import type { CompanyData, EnrichedCompany, QualifiedCompany } from "@/types";

export const fakeCompany: CompanyData = {
  name: "Acme SAS",
  domain: "acme.fr",
  sector: "SaaS",
  location: "75001 Paris",
  employeeCount: 20,
  foundedAt: "2019-01-01",
};

export const fakeQualifiedCompany: QualifiedCompany = {
  ...fakeCompany,
  qualification: {
    score: 0.85,
    reason: "Hiring React developer, recently funded",
    matchedSignals: ["hiring_dev", "recently_funded"],
  },
};

export const fakeEnrichedCompany: EnrichedCompany = {
  ...fakeQualifiedCompany,
  contacts: [
    {
      name: "Alice Martin",
      title: "CTO",
      email: "alice@acme.fr",
      confidence: 90,
      linkedinUrl: "https://linkedin.com/in/alice-martin",
    },
  ],
};
