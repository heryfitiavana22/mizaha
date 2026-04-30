import { z } from "zod";
import type { SearchResult } from "@/types";

export const extractedCompanyNamesSchema = z.object({
  companyNames: z.array(z.string()),
});

export function buildExtractCompanyNamesPrompt({
  results,
}: {
  results: SearchResult[];
}): string {
  const formatted = results
    .map(
      (result, index) =>
        `[${index + 1}] Title: ${result.title}\n     URL: ${result.url}\n     Snippet: ${result.snippet}`,
    )
    .join("\n\n");

  return `You are a B2B lead generation assistant. Extract the names of real prospect companies from these web search results.

Rules:
- For individual job postings: extract the HIRING company name (not the job platform).
- For company pages (careers, about, blog): extract the company name.
- For news articles (funding rounds, product launches, hires): extract the company BEING COVERED — not the news source (TechCrunch, Les Echos, BFM are never prospects).
- Skip aggregated listings that show many companies at once (e.g. "350 offres | Indeed", "Top 50 startups France").
- Skip job boards, freelance platforms, social networks (LinkedIn, Reddit, Twitter...), aggregated directories, company registries — they are not prospects.
- No duplicates.
- If a result yields nothing extractable, skip it.

Results:
${formatted}

Return only the list of real company names.`;
}
