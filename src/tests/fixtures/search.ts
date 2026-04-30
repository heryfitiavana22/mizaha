import type { SearchCriteria } from "@/types";

export const fakeCriteria: SearchCriteria = {
  targetEntity: "company",
  sector: "SaaS",
  location: "Paris",
  techStack: ["React"],
  employeeRange: { min: 5, max: 100 },
  signalSources: ["france_travail", "wttj"],
  searchStrategies: [
    "engineering blog startup React Paris",
    "levée de fonds startup SaaS France 2024",
  ],
  qualificationCriteria: [
    "L'entreprise a une offre d'emploi développeur ouverte",
    "Aucun développeur interne visible dans l'équipe",
  ],
};
