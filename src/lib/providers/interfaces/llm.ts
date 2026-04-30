import type {
  CompanyData,
  Contact,
  JobPosting,
  QualificationResult,
  Result,
  SearchCriteria,
  SearchResult,
} from "@/types";

export type ExtractCriteriaInput = {
  rawQuery: string;
  useCase: string;
  uiCriteria?: Record<string, unknown>;
};

export type QualifyInput = {
  entity: CompanyData | JobPosting;
  criteria: SearchCriteria;
  scrapedContent: string; // mandatory — we never qualify without content
};

export type GenerateDraftInput = {
  contact: Contact;
  companyContext: string;
};

export interface LLMProvider {
  readonly name: string;
  extractCriteria(input: ExtractCriteriaInput): Promise<Result<SearchCriteria>>;
  extractCompanyNames(results: SearchResult[]): Promise<Result<string[]>>;
  qualify(input: QualifyInput): Promise<Result<QualificationResult>>;
  generateDraft(input: GenerateDraftInput): Promise<Result<string>>;
}
