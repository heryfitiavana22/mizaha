import type { CompanyData, Result } from "@/types";

export type CompanyCriteria = {
  sector?: string;
  location?: string;
  minEmployees?: number;
  maxEmployees?: number;
};

export interface CompanyProvider {
  findByDomain(domain: string): Promise<Result<CompanyData | null>>;
  search(criteria: CompanyCriteria): Promise<Result<CompanyData[]>>;
}
