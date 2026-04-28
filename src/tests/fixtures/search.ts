import type { SearchCriteria } from "@/types";

export const fakeCriteria: SearchCriteria = {
  sector: "SaaS",
  location: "Paris",
  signals: ["hiring_dev", "recently_funded"],
  techStack: ["React"],
  employeeRange: { min: 5, max: 100 },
};
