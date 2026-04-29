import { openai } from "@ai-sdk/openai";
import { PappersCompanyProvider } from "@/lib/providers/company/pappers";
import { SireneCompanyProvider } from "@/lib/providers/company/sirene";
import { FirecrawlEmailProvider } from "@/lib/providers/email/firecrawl";
import { VercelLLMProvider } from "@/lib/providers/llm/vercel";
import { FirecrawlScraperProvider } from "@/lib/providers/scraper/firecrawl";
import { BraveSearchProvider } from "@/lib/providers/search/brave";
import type { UseCaseConfig } from "./index";

const OPENAI_MODEL_ID = "gpt-5.4-mini";

export const freelanceConfig: UseCaseConfig = {
  name: "freelance",
  description: "Freelance developer looking for client missions in France",
  enrichStrategy: "domain",
  maxResults: 20,
  providers: {
    search: {
      primary: new BraveSearchProvider(),
    },
    company: {
      primary: new SireneCompanyProvider(),
      backup: new PappersCompanyProvider(), // BROKEN: always 401 in free
    },
    scraper: {
      primary: new FirecrawlScraperProvider(),
      // Playwright backup not yet implemented
    },
    email: {
      primary: new FirecrawlEmailProvider(
        new BraveSearchProvider(),
        new FirecrawlScraperProvider(),
      ),
    },
    llm: new VercelLLMProvider(openai(OPENAI_MODEL_ID), OPENAI_MODEL_ID),
  },
};
