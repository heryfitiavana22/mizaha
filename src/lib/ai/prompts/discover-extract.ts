import { z } from "zod";
import type { SearchResult } from "@/types";

export const extractedCompaniesSchema = z.object({
  companies: z.array(z.string()),
});

export function buildDiscoverExtractPrompt({
  results,
}: {
  results: SearchResult[];
}): string {
  const formatted = results
    .map(
      (r, i) =>
        `[${i + 1}] Title: ${r.title}\n     URL: ${r.url}\n     Snippet: ${r.snippet}`,
    )
    .join("\n\n");

  return `You are a B2B lead generation assistant. Extract the names of real prospect companies from these web search results.

Rules:
- For individual job postings: extract the HIRING company name (not the job platform).
- For company pages (careers, about, blog, news): extract the company name.
- Ignore aggregated results listing many companies (e.g. "350 offres | Indeed") — skip them.
- Ignore job boards, freelance platforms, directories, registries, news outlets — they are not prospects.
- No duplicates.
- If a result yields nothing extractable, skip it.

Results:
${formatted}

Return only the list of company names.`;
}
