import logger from "@/lib/logger";
import type {
  JobBoardProvider,
  JobSearchCriteria,
} from "@/lib/providers/interfaces/job-board";
import type { ScraperProvider } from "@/lib/providers/interfaces/scraper";
import type { JobPosting, Result } from "@/types";

const WTTJ_JOBS_BASE = "https://www.welcometothejungle.com/fr/jobs";

// Matches job links: /fr/companies/<slug>/jobs/<job-slug>
const JOB_LINK_RE =
  /\[([^\]]+)\]\((https:\/\/www\.welcometothejungle\.com\/fr\/companies\/([^/]+)\/jobs\/[^)]+)\)/g;

const CONTRACT_TYPE_PARAM: Record<string, string> = {
  freelance: "freelance",
  cdi: "CDI",
  cdd: "CDD",
  alternance: "alternance",
};

function buildSearchUrl(criteria: JobSearchCriteria): string {
  const params = new URLSearchParams();

  const query = [
    ...(criteria.keywords ?? []),
    ...(criteria.techStack ?? []),
  ].join(" ");
  if (query) params.set("query", query);

  if (criteria.contractType && CONTRACT_TYPE_PARAM[criteria.contractType])
    params.append(
      "contract_type[]",
      CONTRACT_TYPE_PARAM[criteria.contractType],
    );

  if (criteria.remote) params.set("remote", "true");

  return `${WTTJ_JOBS_BASE}?${params}`;
}

function parsePostings(content: string): JobPosting[] {
  const postings: JobPosting[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  JOB_LINK_RE.lastIndex = 0;

  while ((match = JOB_LINK_RE.exec(content)) !== null) {
    const title = match[1].trim();
    const url = match[2];
    const companySlug = match[3];

    if (seen.has(url)) continue;
    seen.add(url);

    // Company name from slug: "acme-sas" → "Acme Sas"
    const companyName = companySlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    // Grab ~400 chars of context around the match as description
    const start = Math.max(0, match.index - 50);
    const end = Math.min(content.length, match.index + match[0].length + 350);
    const description = content
      .slice(start, end)
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    postings.push({
      title,
      companyName,
      url,
      location: "France",
      contractType: "",
      description,
    });
  }

  return postings;
}

export class WttjJobsProvider implements JobBoardProvider {
  readonly name = "WTTJ Jobs";
  readonly signalSource = "wttj" as const;

  constructor(private readonly scraper: ScraperProvider) {}

  async searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>> {
    const start = Date.now();
    const url = buildSearchUrl(criteria);

    const scraped = await this.scraper.scrape(url);

    if (!scraped.success) {
      logger.error(
        {
          provider: "wttj-jobs",
          method: "searchJobs",
          durationMs: Date.now() - start,
          status: "error",
          error: scraped.error.message,
        },
        "API call failed",
      );
      return { success: false, error: scraped.error };
    }

    const content = scraped.data.content;

    const postings = parsePostings(content);

    logger.info(
      {
        provider: "wttj-jobs",
        method: "searchJobs",
        durationMs: Date.now() - start,
        status: "success",
        count: postings.length,
        url,
      },
      "API call completed",
    );

    return { success: true, data: postings };
  }
}
