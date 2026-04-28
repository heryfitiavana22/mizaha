import type { ExtractCriteriaInput } from "@/lib/providers/interfaces/llm";

// Stub — real prompt content is written in Phase 7
export function buildExtractCriteriaPrompt({
  rawQuery,
  useCase,
}: ExtractCriteriaInput): string {
  return `You are a B2B lead generation assistant. Extract structured search criteria from the following natural language query.

Use case: ${useCase}
Query: "${rawQuery}"

Return a JSON object with this exact shape:
{
  "sector": "string or null",
  "location": "string or null",
  "signals": ["array", "of", "signal", "strings"],
  "techStack": ["array", "of", "tech", "strings"],
  "employeeRange": { "min": number, "max": number } or null
}

Return only the JSON object, no explanation.`;
}
