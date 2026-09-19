import { openai } from "@ai-sdk/openai";
import { SireneCompanyProvider } from "@/lib/providers/company/sirene";
import { FirecrawlEmailProvider } from "@/lib/providers/email/firecrawl";
import { FreeWorkProvider } from "@/lib/providers/job-board/free-work";
import { FranceTravailProvider } from "@/lib/providers/job-board/france-travail";
import { VercelLLMProvider } from "@/lib/providers/llm/vercel";
import { FirecrawlScraperProvider } from "@/lib/providers/scraper/firecrawl";
import { BraveSearchProvider } from "@/lib/providers/search/brave";
import type { UseCaseConfig } from "./index";

const OPENAI_MODEL_ID = "gpt-5.4-mini";

const braveSearch = new BraveSearchProvider();

export const findJobsConfig: UseCaseConfig = {
  name: "find-jobs",
  description:
    "Developer looking for job offers or freelance missions in France",
  targetEntity: "job_offer",
  enrichStrategy: "domain",
  maxResults: 30,
  providers: {
    search: braveSearch,
    company: new SireneCompanyProvider(braveSearch),
    scraper: new FirecrawlScraperProvider(),
    email: new FirecrawlEmailProvider(
      braveSearch,
      new FirecrawlScraperProvider(),
    ),
    jobBoard: [new FreeWorkProvider(), new FranceTravailProvider()],
    llm: new VercelLLMProvider(openai(OPENAI_MODEL_ID), OPENAI_MODEL_ID),
  },
};
