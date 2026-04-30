import FirecrawlApp from "@mendable/firecrawl-js";
import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  JobBoardProvider,
  JobSearchCriteria,
} from "@/lib/providers/interfaces/job-board";
import type { JobPosting, Result } from "@/types";

const WTTJ_SEARCH_URL = "https://www.welcometothejungle.com/fr/jobs";
const DEFAULT_LIMIT = 20;

const JOB_TITLE_PATTERN = /##\s+(.+)/g;
const COMPANY_PATTERN = /\*\*Entreprise\s*:\*\*\s*(.+)/gi;
const LOCATION_PATTERN = /\*\*Lieu\s*:\*\*\s*(.+)/gi;
const CONTRACT_PATTERN = /\*\*Type de contrat\s*:\*\*\s*(.+)/gi;
const JOB_URL_PATTERN =
  /\[.*?\]\((https:\/\/www\.welcometothejungle\.com\/fr\/companies\/[^)]+\/jobs\/[^)]+)\)/g;

type RawJobBlock = {
  title: string;
  companyName: string;
  location: string;
  contractType: string;
  url: string;
};

function extractAllMatches({
  content,
  pattern,
}: {
  content: string;
  pattern: RegExp;
}): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  // Global regexes retain lastIndex between calls — reset to avoid skipping matches
  pattern.lastIndex = 0;
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

function parseJobBlocks({ content }: { content: string }): RawJobBlock[] {
  const titles = extractAllMatches({ content, pattern: JOB_TITLE_PATTERN });
  const companies = extractAllMatches({ content, pattern: COMPANY_PATTERN });
  const locations = extractAllMatches({ content, pattern: LOCATION_PATTERN });
  const contracts = extractAllMatches({ content, pattern: CONTRACT_PATTERN });
  const urls = extractAllMatches({ content, pattern: JOB_URL_PATTERN });

  const count = Math.min(titles.length, companies.length, urls.length);
  const blocks: RawJobBlock[] = [];

  for (let i = 0; i < count; i++) {
    blocks.push({
      title: titles[i] ?? "",
      companyName: companies[i] ?? "",
      location: locations[i] ?? "",
      contractType: contracts[i] ?? "",
      url: urls[i] ?? "",
    });
  }

  return blocks;
}

function buildWttjUrl({
  keywords,
  location,
  contractType,
}: JobSearchCriteria): string {
  const params = new URLSearchParams();
  if (keywords?.length) params.set("query", keywords.join(" "));
  if (location) params.set("aroundQuery", location);
  if (contractType) params.set("contract", contractType);
  return `${WTTJ_SEARCH_URL}?${params}`;
}

function blocksToPostings({
  blocks,
  limit,
}: {
  blocks: RawJobBlock[];
  limit: number;
}): JobPosting[] {
  return blocks
    .slice(0, limit)
    .filter((block) => block.title && block.companyName && block.url)
    .map((block) => ({
      title: block.title,
      companyName: block.companyName,
      location: block.location,
      contractType: block.contractType,
      // WTTJ search pages don't include full descriptions — only available on individual job pages
      description: "",
      url: block.url,
    }));
}

export class WttjProvider implements JobBoardProvider {
  readonly name = "WTTJ";
  readonly signalSource = "wttj" as const;
  private readonly client: FirecrawlApp;

  constructor() {
    this.client = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
  }

  async searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>> {
    const start = Date.now();
    const url = buildWttjUrl(criteria);

    try {
      // Each scrape costs 1 Firecrawl credit — logged intentionally
      logger.info(
        { provider: "wttj", method: "searchJobs", url },
        "Firecrawl credit consumed",
      );

      const response = await this.client.scrape(url, { formats: ["markdown"] });
      const content = response.markdown ?? "";
      const blocks = parseJobBlocks({ content });
      const postings = blocksToPostings({
        blocks,
        limit: criteria.limit ?? DEFAULT_LIMIT,
      });

      logger.info(
        {
          provider: "wttj",
          method: "searchJobs",
          durationMs: Date.now() - start,
          status: "success",
          count: postings.length,
        },
        "API call completed",
      );

      return { success: true, data: postings };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "wttj",
          method: "searchJobs",
          durationMs: Date.now() - start,
          status: "error",
          url,
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }
}
