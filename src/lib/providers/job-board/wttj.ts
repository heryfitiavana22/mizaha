import logger from "@/lib/logger";
import type {
  JobBoardProvider,
  JobSearchCriteria,
} from "@/lib/providers/interfaces/job-board";
import type { JobPosting, Result } from "@/types";

// Public client-side keys exposed in WTTJ's page HTML — not secrets
const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_ORG_INDEX = "wk_cms_organizations_production";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_ORG_INDEX}/query`;
const DEFAULT_LIMIT = 30;

type AlgoliaHit = {
  name: string;
  slug: string;
  jobs_count: number;
};

type AlgoliaResponse = {
  hits: AlgoliaHit[];
};

async function fetchWttjCompanies({
  keywords,
  limit,
}: {
  keywords: string[];
  limit: number;
}): Promise<AlgoliaHit[]> {
  const response = await fetch(ALGOLIA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": ALGOLIA_APP_ID,
      "X-Algolia-API-Key": ALGOLIA_API_KEY,
      Referer: "https://www.welcometothejungle.com/",
      Origin: "https://www.welcometothejungle.com",
    },
    body: JSON.stringify({
      query: keywords.join(" "),
      filters: "offices.country_code:FR AND jobs_count > 0",
      hitsPerPage: limit,
      attributesToRetrieve: ["name", "slug", "jobs_count"],
    }),
  });

  if (!response.ok) {
    throw new Error(`WTTJ Algolia API responded with ${response.status}`);
  }

  const data = (await response.json()) as AlgoliaResponse;
  return data.hits ?? [];
}

export class WttjProvider implements JobBoardProvider {
  readonly name = "WTTJ";
  readonly signalSource = "wttj" as const;

  async searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>> {
    const start = Date.now();
    const keywords = criteria.keywords ?? criteria.techStack ?? [];
    const limit = criteria.limit ?? DEFAULT_LIMIT;

    try {
      const hits = await fetchWttjCompanies({ keywords, limit });

      const postings: JobPosting[] = hits.map((hit) => ({
        title: "",
        companyName: hit.name,
        location: "France",
        contractType: "",
        description: "",
        url: `https://www.welcometothejungle.com/fr/companies/${hit.slug}`,
      }));

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
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }
}
