import { openai } from "@ai-sdk/openai";
import { SireneCompanyProvider } from "@/lib/providers/company/sirene";
import { FirecrawlEmailProvider } from "@/lib/providers/email/firecrawl";
import { FranceTravailProvider } from "@/lib/providers/job-board/france-travail";
import { WttjCompanyProvider } from "@/lib/providers/job-board/wttj-company";
import { VercelLLMProvider } from "@/lib/providers/llm/vercel";
import { FirecrawlScraperProvider } from "@/lib/providers/scraper/firecrawl";
import { BraveSearchProvider } from "@/lib/providers/search/brave";
import type { UseCaseConfig } from "./index";

const OPENAI_MODEL_ID = "gpt-5.4-mini";

const braveSearch = new BraveSearchProvider();
const firecrawlScraper = new FirecrawlScraperProvider();

export const freelanceClientConfig: UseCaseConfig = {
  name: "freelance-client",
  description: "Freelance developer looking for client missions in France",
  targetEntity: "company",
  enrichStrategy: "domain",
  maxResults: 30,
  providers: {
    search: braveSearch,
    company: new SireneCompanyProvider(braveSearch),
    scraper: firecrawlScraper,
    email: new FirecrawlEmailProvider(braveSearch, firecrawlScraper),
    jobBoard: [new FranceTravailProvider()],
    companySignals: [new WttjCompanyProvider()],
    llm: new VercelLLMProvider(openai(OPENAI_MODEL_ID), OPENAI_MODEL_ID),
  },
};
