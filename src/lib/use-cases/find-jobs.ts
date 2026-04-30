import { openai } from "@ai-sdk/openai";
import { SireneCompanyProvider } from "@/lib/providers/company/sirene";
import { FirecrawlEmailProvider } from "@/lib/providers/email/firecrawl";
import { FranceTravailProvider } from "@/lib/providers/job-board/france-travail";
import { WttjProvider } from "@/lib/providers/job-board/wttj";
import { VercelLLMProvider } from "@/lib/providers/llm/vercel";
import { FirecrawlScraperProvider } from "@/lib/providers/scraper/firecrawl";
import { BraveSearchProvider } from "@/lib/providers/search/brave";
import type { UseCaseConfig } from "./index";

const OPENAI_MODEL_ID = "gpt-5.4-mini";

export const findJobsConfig: UseCaseConfig = {
  name: "find-jobs",
  description:
    "Developer looking for job offers or freelance missions in France",
  targetEntity: "job_offer",
  enrichStrategy: "domain",
  maxResults: 30,
  providers: {
    search: {
      primary: new BraveSearchProvider(),
    },
    company: {
      primary: new SireneCompanyProvider(),
    },
    scraper: {
      primary: new FirecrawlScraperProvider(),
    },
    email: {
      primary: new FirecrawlEmailProvider(
        new BraveSearchProvider(),
        new FirecrawlScraperProvider(),
      ),
    },
    jobBoard: {
      primary: new FranceTravailProvider(),
      backup: new WttjProvider(),
    },
    llm: new VercelLLMProvider(openai(OPENAI_MODEL_ID), OPENAI_MODEL_ID),
  },
};
