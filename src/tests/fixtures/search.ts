import type { SearchCriteria } from "@/types";

export const fakeCriteria: SearchCriteria = {
  sector: "SaaS",
  location: "Paris",
  techStack: ["React"],
  employeeRange: { min: 5, max: 100 },
  searchStrategies: [
    "offre emploi développeur React startup Paris",
    "recrutement CTO SaaS France 2024",
  ],
  qualificationCriteria: [
    "L'entreprise a une offre d'emploi développeur ouverte",
    "Aucun développeur interne visible dans l'équipe",
  ],
};
