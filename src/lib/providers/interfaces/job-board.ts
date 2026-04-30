import type { JobPosting, Result, SignalSource } from "@/types";

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
  readonly signalSource: SignalSource;
  searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>>;
}
