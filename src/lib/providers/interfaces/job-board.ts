import type { JobPosting, Result } from "@/types";

export type JobSearchCriteria = {
  keywords?: string[];
  location?: string;
  contractType?: "cdi" | "cdd" | "freelance" | "alternance";
  techStack?: string[];
  remote?: boolean;
  limit?: number;
};

export interface JobBoardProvider {
  readonly name: string;
  searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>>;
}
