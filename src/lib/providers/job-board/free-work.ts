import logger from "@/lib/logger";
import type {
  JobBoardProvider,
  JobSearchCriteria,
} from "@/lib/providers/interfaces/job-board";
import type { JobPosting, Result } from "@/types";

const API_BASE = "https://www.free-work.com/api/job_postings";
const SITE_BASE = "https://www.free-work.com/fr/tech-it";
const DEFAULT_LIMIT = 30;

type FreeWorkPosting = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  remoteMode: "full" | "partial" | "none" | null;
  contracts: string[];
  location: { label: string | null; locality: string | null } | null;
  company: { name: string } | null;
  job: { slug: string } | null;
  skills: { name: string }[];
  applicationUrl: string | null;
  publishedAt: string | null;
};

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildUrl(criteria: JobSearchCriteria): string {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("itemsPerPage", String(criteria.limit ?? DEFAULT_LIMIT));
  params.set("locationKeys", "fr~~~");

  const keywords = [
    ...(criteria.keywords ?? []),
    ...(criteria.techStack ?? []),
  ].join(" ");
  if (keywords) params.set("keywords", keywords);

  if (criteria.contractType === "freelance")
    params.set("contracts", "contractor");
  if (criteria.remote) params.set("remoteMode", "full");

  return `${API_BASE}?${params}`;
}

function toJobPosting(item: FreeWorkPosting): JobPosting {
  const jobSlug = item.job?.slug ?? "developer";
  const url =
    item.applicationUrl ?? `${SITE_BASE}/${jobSlug}/job-mission/${item.slug}`;

  return {
    title: item.title,
    companyName: item.company?.name ?? "",
    location: item.location?.label ?? item.location?.locality ?? "France",
    contractType: item.contracts.includes("contractor")
      ? "freelance"
      : (item.contracts[0] ?? ""),
    techStack: item.skills.map((s) => s.name),
    description: stripHtml(item.description),
    url,
    postedAt: item.publishedAt ?? undefined,
  };
}

export class FreeWorkProvider implements JobBoardProvider {
  readonly name = "FreeWork";
  readonly signalSource = "free_work" as const;

  async searchJobs(criteria: JobSearchCriteria): Promise<Result<JobPosting[]>> {
    const start = Date.now();
    const url = buildUrl(criteria);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (!response.ok)
        throw new Error(`FreeWork API responded with ${response.status}`);

      const data = (await response.json()) as FreeWorkPosting[];
      const postings = data.map(toJobPosting);

      logger.info(
        {
          provider: "free-work",
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
          provider: "free-work",
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
