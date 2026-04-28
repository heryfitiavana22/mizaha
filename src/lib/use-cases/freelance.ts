import { anthropic } from "@ai-sdk/anthropic";
import { PappersCompanyProvider } from "@/lib/providers/company/pappers";
import { SireneCompanyProvider } from "@/lib/providers/company/sirene";
import { HunterEmailProvider } from "@/lib/providers/email/hunter";
import { VercelLLMProvider } from "@/lib/providers/llm/vercel";
import { FirecrawlScraperProvider } from "@/lib/providers/scraper/firecrawl";
import { BraveSearchProvider } from "@/lib/providers/search/brave";
import type { UseCaseConfig } from "./index";

const CLAUDE_HAIKU_MODEL_ID = "claude-haiku-4-5-20251001";

export const freelanceConfig: UseCaseConfig = {
  name: "freelance",
  description: "Freelance developer looking for client missions in France",
  signals: ["recently_funded", "hiring_dev", "no_internal_dev", "new_product"],
  scoringWeights: {
    hiring_dev: 0.35,
    no_internal_dev: 0.3,
    recently_funded: 0.2,
    new_product: 0.15,
  },
  providers: {
    search: {
      primary: new BraveSearchProvider(),
      // SerpAPI backup not yet implemented (Phase 6 MVP only)
    },
    company: {
      primary: new PappersCompanyProvider(),
      backup: new SireneCompanyProvider(),
    },
    scraper: {
      primary: new FirecrawlScraperProvider(),
      // Playwright backup not yet implemented (Phase 6 MVP only)
    },
    email: {
      primary: new HunterEmailProvider(),
      // Apollo backup not yet implemented (Phase 6 MVP only)
    },
    llm: new VercelLLMProvider(
      anthropic(CLAUDE_HAIKU_MODEL_ID),
      CLAUDE_HAIKU_MODEL_ID,
    ),
  },
};
