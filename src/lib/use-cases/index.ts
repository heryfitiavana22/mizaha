import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { CompanySignalProvider } from "@/lib/providers/interfaces/company-signal";
import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type { JobBoardProvider } from "@/lib/providers/interfaces/job-board";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import type { Result } from "@/types";
import { findJobsConfig } from "./find-jobs";
import { freelanceClientConfig } from "./freelance-client";

export type UseCaseProviders = {
  search: SearchProvider;
  company: CompanyProvider;
  scraper: ScraperProvider;
  email: EmailProvider;
  jobBoard?: JobBoardProvider[];
  companySignals?: CompanySignalProvider[];
  llm: LLMProvider;
};

export type EnrichStrategy = "domain" | "persona";

export type UseCaseConfig = {
  name: string;
  description: string;
  targetEntity: "company" | "job_offer";
  providers: UseCaseProviders;
  enrichStrategy: EnrichStrategy;
  maxResults: number;
};

const USE_CASE_REGISTRY: Record<string, UseCaseConfig> = {
  "freelance-client": freelanceClientConfig,
  "find-jobs": findJobsConfig,
};

export function getUseCase({ name }: { name: string }): Result<UseCaseConfig> {
  const config = USE_CASE_REGISTRY[name];
  if (!config)
    return { success: false, error: new Error(`Unknown use case: "${name}"`) };
  return { success: true, data: config };
}
