import type { QualifyInput } from "@/lib/providers/interfaces/llm";

// Stub — real prompt content is written in Phase 7
export function buildQualifyPrompt({
  company,
  criteria,
}: QualifyInput): string {
  return `You are a B2B lead qualification assistant. Score the following company against the search criteria.

Company:
${JSON.stringify(company, null, 2)}

Criteria:
${JSON.stringify(criteria, null, 2)}

Return a JSON object with this exact shape:
{
  "score": number between 0.0 and 1.0,
  "reason": "readable explanation of the score",
  "matchedSignals": ["list", "of", "matched", "signal", "strings"]
}

Return only the JSON object, no explanation.`;
}
