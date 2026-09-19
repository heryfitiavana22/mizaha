import logger from "@/lib/logger";
import type {
  CompanyDiscoveryCriteria,
  CompanySignal,
  CompanySignalProvider,
} from "@/lib/providers/interfaces/company-signal";
import type { Result } from "@/types";

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

export class WttjCompanyProvider implements CompanySignalProvider {
  readonly name = "WTTJ";
  readonly signalSource = "wttj" as const;

  async discoverCompanies(
    criteria: CompanyDiscoveryCriteria,
  ): Promise<Result<CompanySignal[]>> {
    const start = Date.now();
    const keywords = criteria.keywords ?? [];
    const limit = criteria.limit ?? DEFAULT_LIMIT;

    try {
      const hits = await fetchWttjCompanies({ keywords, limit });

      const signals: CompanySignal[] = hits.map((hit) => ({
        companyName: hit.name,
        profileUrl: `https://www.welcometothejungle.com/fr/companies/${hit.slug}`,
      }));

      logger.info(
        {
          provider: "wttj",
          method: "discoverCompanies",
          durationMs: Date.now() - start,
          status: "success",
          count: signals.length,
        },
        "API call completed",
      );

      return { success: true, data: signals };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "wttj",
          method: "discoverCompanies",
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
