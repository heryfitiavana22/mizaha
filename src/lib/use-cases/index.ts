import type { CompanyProvider } from "@/lib/providers/interfaces/company";
import type { EmailProvider } from "@/lib/providers/interfaces/email";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import type { SearchProvider } from "@/lib/providers/interfaces/search";
import { freelanceConfig } from "./freelance";

export type UseCaseProviders = {
  search: { primary: SearchProvider; backup?: SearchProvider };
  company: { primary: CompanyProvider; backup?: CompanyProvider };
  scraper: { primary: ScraperProvider; backup?: ScraperProvider };
  email: { primary: EmailProvider; backup?: EmailProvider };
  llm: LLMProvider;
};

export type UseCaseConfig = {
  name: string;
  description: string;
  signals: string[];
  scoringWeights: Record<string, number>;
  providers: UseCaseProviders;
};

const USE_CASE_REGISTRY: Record<string, UseCaseConfig> = {
  freelance: freelanceConfig,
};

export function getUseCase({ name }: { name: string }): UseCaseConfig {
  const config = USE_CASE_REGISTRY[name];
  if (!config) throw new Error(`Unknown use case: "${name}"`);
  return config;
}
