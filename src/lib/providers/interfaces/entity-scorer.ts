import type {
  CompanyData,
  JobPosting,
  QualificationResult,
  Result,
  SearchCriteria,
} from "@/types";

export type QualifyInput = {
  entity: CompanyData | JobPosting;
  criteria: SearchCriteria;
  scrapedContent: string;
};

export interface EntityScorerProvider {
  readonly name: string;
  qualify(input: QualifyInput): Promise<Result<QualificationResult>>;
}
