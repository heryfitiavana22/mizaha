import type { EnrichedJobOffer, JobPosting, QualifiedJobOffer } from "@/types";
import { fakeCompany } from "./company";

export const fakeJobPosting: JobPosting = {
  title: "Développeur React Senior",
  companyName: "Acme SAS",
  location: "Paris (75)",
  contractType: "CDI",
  description:
    "We are a SaaS startup looking for a senior React developer. Our stack: TypeScript, React, Node.js. Remote-friendly, Series A funded. Contact jobs@acme.fr.",
  url: "https://francetravail.fr/offres/123",
  postedAt: "2024-01-15",
  source: "france_travail",
};

export const fakeQualifiedJobOffer: QualifiedJobOffer = {
  ...fakeJobPosting,
  qualification: {
    score: 0.85,
    reason: "Matches React + remote criteria",
    matchedCriteria: [
      "L'offre recherche un développeur React",
      "Startup en phase de croissance",
    ],
  },
  scrapedContent: fakeJobPosting.description,
};

export const fakeEnrichedJobOffer: EnrichedJobOffer = {
  ...fakeQualifiedJobOffer,
  company: fakeCompany,
  contacts: [],
};
