import type {
  CompanyData,
  Contact,
  QualificationResult,
  Result,
  SearchCriteria,
} from "@/types";

export type ExtractCriteriaInput = {
  rawQuery: string;
  useCase: string;
  uiCriteria?: Record<string, unknown>;
};

export type QualifyInput = {
  company: CompanyData;
  criteria: SearchCriteria;
  scrapedContent?: string;
};

export type GenerateDraftInput = {
  contact: Contact;
  companyContext: string;
};

export interface LLMProvider {
  extractCriteria(input: ExtractCriteriaInput): Promise<Result<SearchCriteria>>;
  qualify(input: QualifyInput): Promise<Result<QualificationResult>>;
  generateDraft(input: GenerateDraftInput): Promise<Result<string>>;
}
